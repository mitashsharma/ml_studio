"""Dataset upload, profiling, preview and management."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_file
from werkzeug.utils import secure_filename

from ..extensions import db
from ..ml import load_dataframe, preview_records, profile_dataframe
from ..models import Dataset
from ..security import ApiError, current_user, login_required

bp = Blueprint("datasets", __name__, url_prefix="/api/datasets")

SAMPLES_DIR = Path(__file__).resolve().parent.parent.parent / "samples"


def _user_dir() -> Path:
    folder = Path(current_app.config["UPLOAD_FOLDER"]) / str(current_user().id)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _get_owned(dataset_id: int) -> Dataset:
    dataset = db.session.get(Dataset, dataset_id)
    if dataset is None or dataset.user_id != current_user().id:
        raise ApiError("Dataset not found.", 404)
    return dataset


def _register_dataset(source: Path, display_name: str, original_filename: str) -> Dataset:
    """Profile a file already stored on disk and persist a Dataset row."""
    try:
        df = load_dataframe(source)
    except Exception as exc:
        source.unlink(missing_ok=True)
        raise ApiError(f"Could not read that file: {exc}", 400)

    if df.empty or df.shape[1] < 2:
        source.unlink(missing_ok=True)
        raise ApiError("A dataset needs at least one feature column and one target column.", 400)

    dataset = Dataset(
        user_id=current_user().id,
        name=display_name,
        original_filename=original_filename,
        stored_filename=source.name,
        file_size=source.stat().st_size,
        n_rows=int(df.shape[0]),
        n_columns=int(df.shape[1]),
    )
    dataset.profile = profile_dataframe(df)
    db.session.add(dataset)
    db.session.commit()
    return dataset


@bp.get("")
@login_required
def list_datasets():
    datasets = (
        Dataset.query.filter_by(user_id=current_user().id)
        .order_by(Dataset.created_at.desc())
        .all()
    )
    return jsonify({"datasets": [d.to_dict() for d in datasets]})


@bp.post("")
@login_required
def upload_dataset():
    if "file" not in request.files:
        raise ApiError("No file was included in the request.", 400)

    file = request.files["file"]
    if not file.filename:
        raise ApiError("Please choose a file to upload.", 400)

    filename = secure_filename(file.filename)
    suffix = Path(filename).suffix.lower()
    allowed = current_app.config["ALLOWED_EXTENSIONS"]
    if suffix not in allowed:
        raise ApiError(f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(allowed))}", 400)

    stored_name = f"{uuid.uuid4().hex}{suffix}"
    destination = _user_dir() / stored_name
    file.save(destination)

    display_name = (request.form.get("name") or Path(filename).stem).strip()[:200]
    dataset = _register_dataset(destination, display_name or filename, filename)
    return jsonify({"dataset": dataset.to_dict(include_profile=True)}), 201


@bp.get("/samples")
@login_required
def list_samples():
    samples = []
    if SAMPLES_DIR.exists():
        for path in sorted(SAMPLES_DIR.glob("*.csv")):
            samples.append(
                {
                    "key": path.stem,
                    "name": path.stem.replace("_", " ").title(),
                    "size": path.stat().st_size,
                }
            )
    return jsonify({"samples": samples})


@bp.post("/samples/<key>")
@login_required
def import_sample(key: str):
    safe_key = secure_filename(key)
    source = SAMPLES_DIR / f"{safe_key}.csv"
    if not source.exists():
        raise ApiError("Unknown sample dataset.", 404)

    stored_name = f"{uuid.uuid4().hex}.csv"
    destination = _user_dir() / stored_name
    shutil.copyfile(source, destination)

    dataset = _register_dataset(
        destination, safe_key.replace("_", " ").title(), f"{safe_key}.csv"
    )
    return jsonify({"dataset": dataset.to_dict(include_profile=True)}), 201


@bp.get("/<int:dataset_id>")
@login_required
def get_dataset(dataset_id: int):
    dataset = _get_owned(dataset_id)
    return jsonify({"dataset": dataset.to_dict(include_profile=True)})


@bp.get("/<int:dataset_id>/preview")
@login_required
def preview_dataset(dataset_id: int):
    dataset = _get_owned(dataset_id)
    limit = min(int(request.args.get("limit", 25)), 200)
    path = Path(current_app.config["UPLOAD_FOLDER"]) / str(dataset.user_id) / dataset.stored_filename
    if not path.exists():
        raise ApiError("The stored file for this dataset is missing.", 410)
    df = load_dataframe(path, nrows=limit)
    return jsonify(preview_records(df, limit))


@bp.delete("/<int:dataset_id>")
@login_required
def delete_dataset(dataset_id: int):
    dataset = _get_owned(dataset_id)
    path = Path(current_app.config["UPLOAD_FOLDER"]) / str(dataset.user_id) / dataset.stored_filename
    path.unlink(missing_ok=True)
    db.session.delete(dataset)
    db.session.commit()
    return jsonify({"deleted": dataset_id})


@bp.get("/<int:dataset_id>/download")
@login_required
def download_dataset(dataset_id: int):
    dataset = _get_owned(dataset_id)
    path = Path(current_app.config["UPLOAD_FOLDER"]) / str(dataset.user_id) / dataset.stored_filename
    if not path.exists():
        raise ApiError("The stored file for this dataset is missing.", 410)
    return send_file(path, as_attachment=True, download_name=dataset.original_filename)


def dataset_path(dataset: Dataset) -> Path:
    return Path(current_app.config["UPLOAD_FOLDER"]) / str(dataset.user_id) / dataset.stored_filename
