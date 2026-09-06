"""Training runs, model registry, and live predictions."""

from __future__ import annotations

import uuid
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_file

from ..extensions import db
from ..ml import get_algorithm, load_dataframe, predict_with_artifact, suggest_task, train
from ..ml.algorithms import DEFAULT_ALGORITHM
from ..ml.trainer import TrainingError
from ..models import Dataset, Experiment
from ..security import ApiError, current_user, login_required
from .datasets import dataset_path

bp = Blueprint("experiments", __name__, url_prefix="/api/experiments")


def _get_owned(experiment_id: int) -> Experiment:
    experiment = db.session.get(Experiment, experiment_id)
    if experiment is None or experiment.user_id != current_user().id:
        raise ApiError("Experiment not found.", 404)
    return experiment


@bp.get("")
@login_required
def list_experiments():
    query = Experiment.query.filter_by(user_id=current_user().id)
    dataset_id = request.args.get("dataset_id", type=int)
    if dataset_id:
        query = query.filter_by(dataset_id=dataset_id)
    experiments = query.order_by(Experiment.created_at.desc()).all()
    return jsonify({"experiments": [e.to_dict() for e in experiments]})


@bp.post("")
@login_required
def create_experiment():
    data = request.get_json(silent=True) or {}

    dataset_id = data.get("dataset_id")
    dataset = db.session.get(Dataset, dataset_id) if dataset_id else None
    if dataset is None or dataset.user_id != current_user().id:
        raise ApiError("Choose a dataset you own.", 404)

    target = (data.get("target_column") or "").strip()
    if not target:
        raise ApiError("Pick a target column to predict.", 422, {"target_column": "Required."})

    path = dataset_path(dataset)
    if not path.exists():
        raise ApiError("The stored file for this dataset is missing.", 410)

    df = load_dataframe(path)
    if target not in df.columns:
        raise ApiError(f"'{target}' is not a column in this dataset.", 422)

    features = data.get("feature_columns") or [c for c in df.columns if c != target]
    features = [c for c in features if c != target]
    if not features:
        raise ApiError("Select at least one feature column.", 422)

    task_type = data.get("task_type") or suggest_task(df[target])
    algorithm_key = data.get("algorithm") or DEFAULT_ALGORITHM[task_type]
    algorithm = get_algorithm(algorithm_key)
    if algorithm is None:
        raise ApiError(f"Unknown algorithm '{algorithm_key}'.", 422)

    test_size = float(data.get("test_size", 0.2))
    if not 0.05 <= test_size <= 0.5:
        raise ApiError("Test size must be between 5% and 50%.", 422)

    name = (data.get("name") or f"{algorithm.label} · {target}").strip()[:200]

    experiment = Experiment(
        user_id=current_user().id,
        dataset_id=dataset.id,
        name=name,
        task_type=task_type,
        algorithm=algorithm.key,
        target_column=target,
        status="running",
    )
    experiment.feature_columns = features
    db.session.add(experiment)
    db.session.commit()

    artifact_dir = Path(current_app.config["ARTIFACT_FOLDER"]) / str(current_user().id)
    artifact_file = artifact_dir / f"experiment_{experiment.id}_{uuid.uuid4().hex[:8]}.joblib"

    try:
        result = train(
            df=df,
            target=target,
            features=features,
            algorithm_key=algorithm.key,
            task_type=task_type,
            test_size=test_size,
            cross_validation=bool(data.get("cross_validation", False)),
            cv_folds=int(data.get("cv_folds", 5)),
            hyperparams=data.get("hyperparams") or {},
            artifact_path=artifact_file,
        )
    except TrainingError as exc:
        experiment.status = "failed"
        experiment.error_message = str(exc)
        db.session.commit()
        raise ApiError(str(exc), 422, {"experiment_id": experiment.id})
    except Exception as exc:  # pragma: no cover - unexpected sklearn failure
        experiment.status = "failed"
        experiment.error_message = str(exc)
        db.session.commit()
        raise ApiError(f"Training failed unexpectedly: {exc}", 500)

    experiment.status = "success"
    experiment.metrics = result.metrics
    experiment.charts = result.charts
    experiment.params = result.params
    experiment.task_type = result.task_type
    experiment.duration_ms = result.duration_ms
    experiment.artifact_path = result.artifact_path
    db.session.commit()

    return jsonify({"experiment": experiment.to_dict(detailed=True)}), 201


@bp.get("/<int:experiment_id>")
@login_required
def get_experiment(experiment_id: int):
    experiment = _get_owned(experiment_id)
    payload = experiment.to_dict(detailed=True)
    algorithm = get_algorithm(experiment.algorithm)
    payload["algorithm_label"] = algorithm.label if algorithm else experiment.algorithm
    return jsonify({"experiment": payload})


@bp.delete("/<int:experiment_id>")
@login_required
def delete_experiment(experiment_id: int):
    experiment = _get_owned(experiment_id)
    if experiment.artifact_path:
        Path(experiment.artifact_path).unlink(missing_ok=True)
    db.session.delete(experiment)
    db.session.commit()
    return jsonify({"deleted": experiment_id})


@bp.get("/<int:experiment_id>/schema")
@login_required
def prediction_schema(experiment_id: int):
    """Feature schema used to build the live prediction form."""
    import joblib

    experiment = _get_owned(experiment_id)
    if not experiment.artifact_path or not Path(experiment.artifact_path).exists():
        raise ApiError("This model has no saved artifact to predict with.", 410)

    bundle = joblib.load(experiment.artifact_path)
    return jsonify(
        {
            "task_type": bundle["task_type"],
            "target": bundle["target"],
            "features": bundle["feature_schema"],
            "class_labels": bundle.get("class_labels", []),
        }
    )


@bp.post("/<int:experiment_id>/predict")
@login_required
def predict(experiment_id: int):
    experiment = _get_owned(experiment_id)
    if not experiment.artifact_path or not Path(experiment.artifact_path).exists():
        raise ApiError("This model has no saved artifact to predict with.", 410)

    data = request.get_json(silent=True) or {}
    rows = data.get("rows")
    if isinstance(data.get("row"), dict):
        rows = [data["row"]]
    if not isinstance(rows, list) or not rows:
        raise ApiError("Send a 'row' object or a 'rows' array of feature values.", 422)
    if len(rows) > 500:
        raise ApiError("Limit batch predictions to 500 rows.", 422)

    try:
        result = predict_with_artifact(experiment.artifact_path, rows)
    except Exception as exc:
        raise ApiError(f"Prediction failed: {exc}", 422)

    return jsonify(result)


@bp.get("/<int:experiment_id>/download")
@login_required
def download_model(experiment_id: int):
    experiment = _get_owned(experiment_id)
    if not experiment.artifact_path or not Path(experiment.artifact_path).exists():
        raise ApiError("This model has no saved artifact.", 410)
    return send_file(
        experiment.artifact_path,
        as_attachment=True,
        download_name=f"{experiment.name.replace(' ', '_')}.joblib",
    )
