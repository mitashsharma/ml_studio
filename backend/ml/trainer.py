"""The training engine: preprocessing pipeline, fitting, metrics and charts.

Everything returned here is plain JSON so the React front end can render it
with no extra server-side plotting.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler

from .algorithms import CLASSIFICATION, REGRESSION, get_algorithm
from .profiling import infer_semantic_type, jsonify_value, suggest_task

MAX_SCATTER_POINTS = 400


class TrainingError(Exception):
    """Raised when a dataset/config combination cannot be trained."""


@dataclass
class TrainingResult:
    task_type: str
    algorithm: str
    metrics: dict
    charts: dict
    params: dict
    feature_columns: list[str]
    duration_ms: int
    artifact_path: str | None = None


# ---------------------------------------------------------------------------
# Pipeline construction
# ---------------------------------------------------------------------------

def split_feature_types(X: pd.DataFrame) -> tuple[list[str], list[str]]:
    numeric, categorical = [], []
    for col in X.columns:
        if infer_semantic_type(X[col]) == "numeric":
            numeric.append(col)
        else:
            categorical.append(col)
    return numeric, categorical


def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    numeric, categorical = split_feature_types(X)

    numeric_pipe = Pipeline(
        steps=[("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]
    )
    categorical_pipe = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("encode", OneHotEncoder(handle_unknown="ignore", max_categories=25, sparse_output=False)),
        ]
    )

    transformers = []
    if numeric:
        transformers.append(("num", numeric_pipe, numeric))
    if categorical:
        transformers.append(("cat", categorical_pipe, categorical))
    if not transformers:
        raise TrainingError("No usable feature columns were selected.")

    return ColumnTransformer(transformers=transformers, remainder="drop")


def prepare_frame(df: pd.DataFrame, target: str, features: list[str]) -> tuple[pd.DataFrame, pd.Series]:
    missing = [c for c in [target, *features] if c not in df.columns]
    if missing:
        raise TrainingError(f"Columns not found in dataset: {', '.join(missing)}")

    work = df[[*features, target]].copy()
    # Datetime columns become numeric timestamps so they still carry signal.
    for col in work.columns:
        if pd.api.types.is_datetime64_any_dtype(work[col]):
            work[col] = work[col].view("int64") // 10**9

    work = work.dropna(subset=[target])
    if work.empty:
        raise TrainingError("Every row has a missing target value — nothing to learn from.")
    if len(work) < 10:
        raise TrainingError("At least 10 usable rows are required to train a model.")

    y = work[target]
    X = work[features]
    return X, y


# ---------------------------------------------------------------------------
# Feature importance
# ---------------------------------------------------------------------------

def _aggregate_importance(names: list[str], values: np.ndarray, original: list[str]) -> list[dict]:
    totals: dict[str, float] = {col: 0.0 for col in original}
    for name, value in zip(names, values):
        clean = name.split("__", 1)[-1]
        match = None
        for col in original:
            if clean == col or clean.startswith(f"{col}_"):
                if match is None or len(col) > len(match):
                    match = col
        if match is None:
            continue
        totals[match] += float(abs(value))

    total = sum(totals.values())
    if total <= 0:
        return []
    ranked = [
        {"feature": col, "importance": round(val / total * 100, 2)}
        for col, val in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
        if val > 0
    ]
    return ranked[:20]


def compute_feature_importance(
    pipeline: Pipeline,
    X_test: pd.DataFrame,
    y_test: np.ndarray,
    feature_columns: list[str],
) -> list[dict]:
    model = pipeline.named_steps["model"]
    pre = pipeline.named_steps["preprocess"]

    try:
        names = list(pre.get_feature_names_out())
    except Exception:  # pragma: no cover - defensive
        names = []

    values: np.ndarray | None = None
    if hasattr(model, "feature_importances_"):
        values = np.asarray(model.feature_importances_, dtype=float)
    elif hasattr(model, "coef_"):
        coef = np.asarray(model.coef_, dtype=float)
        values = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)

    if values is not None and names and len(values) == len(names):
        ranked = _aggregate_importance(names, values, feature_columns)
        if ranked:
            return ranked

    # Fall back to permutation importance (works for any estimator).
    try:
        sample = min(len(X_test), 300)
        result = permutation_importance(
            pipeline,
            X_test.iloc[:sample],
            y_test[:sample],
            n_repeats=5,
            random_state=42,
            n_jobs=1,
        )
        return _aggregate_importance(
            feature_columns, np.clip(result.importances_mean, 0, None), feature_columns
        )
    except Exception:  # pragma: no cover - importance is best effort
        return []


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def classification_metrics(y_true, y_pred, y_proba, labels: list[str]) -> tuple[dict, dict]:
    metrics = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "balanced_accuracy": round(float(balanced_accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "n_classes": len(labels),
    }

    if y_proba is not None:
        try:
            if len(labels) == 2:
                metrics["roc_auc"] = round(float(roc_auc_score(y_true, y_proba[:, 1])), 4)
            else:
                metrics["roc_auc"] = round(
                    float(roc_auc_score(y_true, y_proba, multi_class="ovr", average="weighted")), 4
                )
        except Exception:
            pass

    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(labels))))
    report = classification_report(
        y_true, y_pred, labels=list(range(len(labels))), target_names=labels,
        output_dict=True, zero_division=0,
    )

    per_class = [
        {
            "label": label,
            "precision": round(float(report[label]["precision"]), 4),
            "recall": round(float(report[label]["recall"]), 4),
            "f1": round(float(report[label]["f1-score"]), 4),
            "support": int(report[label]["support"]),
        }
        for label in labels
        if label in report
    ]

    charts = {
        "confusion_matrix": {"labels": labels, "matrix": cm.astype(int).tolist()},
        "per_class": per_class,
        "class_distribution": [
            {"label": label, "count": int((np.asarray(y_true) == idx).sum())}
            for idx, label in enumerate(labels)
        ],
    }
    return metrics, charts


def regression_metrics(y_true, y_pred) -> tuple[dict, dict]:
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    residuals = y_true - y_pred

    mse = float(mean_squared_error(y_true, y_pred))
    with np.errstate(divide="ignore", invalid="ignore"):
        denom = np.where(np.abs(y_true) < 1e-9, np.nan, np.abs(y_true))
        mape = float(np.nanmean(np.abs(residuals / denom)) * 100)

    metrics = {
        "r2": round(float(r2_score(y_true, y_pred)), 4),
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "rmse": round(float(np.sqrt(mse)), 4),
        "mse": round(mse, 4),
        "mape": None if np.isnan(mape) else round(mape, 2),
        "target_mean": round(float(np.mean(y_true)), 4),
        "target_std": round(float(np.std(y_true)), 4),
    }

    step = max(1, len(y_true) // MAX_SCATTER_POINTS)
    scatter = [
        {"actual": jsonify_value(a), "predicted": jsonify_value(p)}
        for a, p in zip(y_true[::step], y_pred[::step])
    ]

    counts, edges = np.histogram(residuals, bins=min(20, max(5, len(residuals) // 5 or 5)))
    charts = {
        "actual_vs_predicted": scatter,
        "residual_histogram": [
            {"bin": f"{edges[i]:.3g}", "count": int(counts[i])} for i in range(len(counts))
        ],
        "residual_stats": {
            "mean": round(float(np.mean(residuals)), 4),
            "std": round(float(np.std(residuals)), 4),
        },
    }
    return metrics, charts


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def train(
    df: pd.DataFrame,
    target: str,
    features: list[str],
    algorithm_key: str,
    task_type: str | None = None,
    test_size: float = 0.2,
    cross_validation: bool = False,
    cv_folds: int = 5,
    hyperparams: dict | None = None,
    artifact_path: str | Path | None = None,
) -> TrainingResult:
    started = time.perf_counter()

    X, y = prepare_frame(df, target, features)
    task_type = task_type or suggest_task(y)
    if task_type not in {CLASSIFICATION, REGRESSION}:
        raise TrainingError(f"Unknown task type '{task_type}'.")

    algorithm = get_algorithm(algorithm_key)
    if algorithm is None:
        raise TrainingError(f"Unknown algorithm '{algorithm_key}'.")
    if algorithm.task != task_type:
        raise TrainingError(
            f"{algorithm.label} is a {algorithm.task} model but the task is {task_type}."
        )

    label_encoder: LabelEncoder | None = None
    class_labels: list[str] = []
    if task_type == CLASSIFICATION:
        label_encoder = LabelEncoder()
        y_encoded = label_encoder.fit_transform(y.astype("string").fillna("missing"))
        class_labels = [str(c) for c in label_encoder.classes_]
        if len(class_labels) < 2:
            raise TrainingError("The target column needs at least two distinct classes.")
        if len(class_labels) > 50:
            raise TrainingError(
                "That target has more than 50 distinct values — it looks like a regression target."
            )
    else:
        try:
            y_encoded = pd.to_numeric(y, errors="raise").to_numpy(dtype=float)
        except Exception as exc:
            raise TrainingError(
                f"Target '{target}' is not numeric, so it cannot be used for regression."
            ) from exc

    stratify = y_encoded if task_type == CLASSIFICATION else None
    if stratify is not None:
        counts = pd.Series(y_encoded).value_counts()
        if counts.min() < 2:
            stratify = None

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=test_size, random_state=42, stratify=stratify
    )

    pipeline = Pipeline(
        steps=[
            ("preprocess", build_preprocessor(X)),
            ("model", algorithm.build(hyperparams)),
        ]
    )

    try:
        pipeline.fit(X_train, y_train)
    except Exception as exc:  # surface sklearn errors in human language
        raise TrainingError(f"Training failed: {exc}") from exc

    y_pred = pipeline.predict(X_test)

    if task_type == CLASSIFICATION:
        y_proba = None
        if hasattr(pipeline.named_steps["model"], "predict_proba"):
            try:
                y_proba = pipeline.predict_proba(X_test)
            except Exception:
                y_proba = None
        metrics, charts = classification_metrics(y_test, y_pred, y_proba, class_labels)
    else:
        metrics, charts = regression_metrics(y_test, y_pred)

    metrics.update(
        {
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "n_features": int(len(features)),
        }
    )

    if cross_validation:
        scoring = "accuracy" if task_type == CLASSIFICATION else "r2"
        folds = int(max(2, min(cv_folds, 10)))
        try:
            scores = cross_val_score(pipeline, X, y_encoded, cv=folds, scoring=scoring, n_jobs=1)
            metrics["cv_mean"] = round(float(scores.mean()), 4)
            metrics["cv_std"] = round(float(scores.std()), 4)
            charts["cv_scores"] = [
                {"fold": f"Fold {i + 1}", "score": round(float(s), 4)} for i, s in enumerate(scores)
            ]
        except Exception:
            metrics["cv_mean"] = None

    charts["feature_importance"] = compute_feature_importance(
        pipeline, X_test, np.asarray(y_test), list(features)
    )

    saved_path: str | None = None
    if artifact_path:
        artifact_path = Path(artifact_path)
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "pipeline": pipeline,
                "label_encoder": label_encoder,
                "task_type": task_type,
                "target": target,
                "features": list(features),
                "class_labels": class_labels,
                "feature_schema": feature_schema(X),
                "algorithm": algorithm.key,
            },
            artifact_path,
        )
        saved_path = str(artifact_path)

    return TrainingResult(
        task_type=task_type,
        algorithm=algorithm.key,
        metrics=metrics,
        charts=charts,
        params={
            "test_size": test_size,
            "cross_validation": cross_validation,
            "cv_folds": cv_folds if cross_validation else None,
            "hyperparams": hyperparams or {},
            "class_labels": class_labels,
        },
        feature_columns=list(features),
        duration_ms=int((time.perf_counter() - started) * 1000),
        artifact_path=saved_path,
    )


def feature_schema(X: pd.DataFrame) -> list[dict]:
    """Describe each feature so the UI can build a prediction form."""
    schema = []
    for col in X.columns:
        series = X[col]
        kind = infer_semantic_type(series)
        entry: dict[str, Any] = {"name": str(col), "type": kind}
        if kind == "numeric":
            entry["min"] = jsonify_value(series.min())
            entry["max"] = jsonify_value(series.max())
            entry["default"] = jsonify_value(series.median())
        else:
            options = series.astype("string").value_counts().head(30).index.tolist()
            entry["options"] = [str(o) for o in options]
            entry["default"] = entry["options"][0] if entry["options"] else ""
        schema.append(entry)
    return schema


def predict_with_artifact(artifact_path: str | Path, rows: list[dict]) -> dict:
    """Load a saved pipeline and score one or more input rows."""
    bundle = joblib.load(artifact_path)
    pipeline: Pipeline = bundle["pipeline"]
    features: list[str] = bundle["features"]

    frame = pd.DataFrame(rows)
    for col in features:
        if col not in frame.columns:
            frame[col] = np.nan
    frame = frame[features]

    # Coerce anything numeric-looking so "12" behaves like 12.
    for col in features:
        converted = pd.to_numeric(frame[col], errors="coerce")
        if converted.notna().sum() >= frame[col].notna().sum():
            frame[col] = converted

    preds = pipeline.predict(frame)
    output: dict[str, Any] = {"task_type": bundle["task_type"], "target": bundle["target"]}

    if bundle["task_type"] == CLASSIFICATION:
        encoder: LabelEncoder = bundle["label_encoder"]
        labels = encoder.inverse_transform(np.asarray(preds, dtype=int))
        output["predictions"] = [str(v) for v in labels]
        if hasattr(pipeline.named_steps["model"], "predict_proba"):
            try:
                proba = pipeline.predict_proba(frame)
                output["probabilities"] = [
                    [
                        {"label": str(cls), "probability": round(float(p), 4)}
                        for cls, p in sorted(
                            zip(bundle["class_labels"], row), key=lambda kv: kv[1], reverse=True
                        )
                    ]
                    for row in proba
                ]
            except Exception:
                pass
    else:
        output["predictions"] = [jsonify_value(v) for v in np.asarray(preds, dtype=float)]

    return output
