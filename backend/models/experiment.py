from __future__ import annotations

import json

from ..extensions import db
from .user import utcnow


class Experiment(db.Model):
    """One training run: configuration, metrics and the persisted pipeline."""

    __tablename__ = "experiments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey("datasets.id"), nullable=False, index=True)

    name = db.Column(db.String(200), nullable=False)
    task_type = db.Column(db.String(30), nullable=False)          # classification | regression
    algorithm = db.Column(db.String(60), nullable=False)
    target_column = db.Column(db.String(200), nullable=False)
    feature_columns_json = db.Column(db.Text, default="[]")
    params_json = db.Column(db.Text, default="{}")
    metrics_json = db.Column(db.Text, default="{}")
    charts_json = db.Column(db.Text, default="{}")
    status = db.Column(db.String(20), default="pending")           # pending|success|failed
    error_message = db.Column(db.Text)
    artifact_path = db.Column(db.String(500))
    duration_ms = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    owner = db.relationship("User", back_populates="experiments")
    dataset = db.relationship("Dataset", back_populates="experiments")

    # -- JSON helpers -------------------------------------------------------
    @staticmethod
    def _load(raw: str | None, fallback):
        try:
            return json.loads(raw) if raw else fallback
        except json.JSONDecodeError:
            return fallback

    @property
    def feature_columns(self) -> list:
        return self._load(self.feature_columns_json, [])

    @feature_columns.setter
    def feature_columns(self, value: list) -> None:
        self.feature_columns_json = json.dumps(value)

    @property
    def params(self) -> dict:
        return self._load(self.params_json, {})

    @params.setter
    def params(self, value: dict) -> None:
        self.params_json = json.dumps(value, default=str)

    @property
    def metrics(self) -> dict:
        return self._load(self.metrics_json, {})

    @metrics.setter
    def metrics(self, value: dict) -> None:
        self.metrics_json = json.dumps(value, default=str)

    @property
    def charts(self) -> dict:
        return self._load(self.charts_json, {})

    @charts.setter
    def charts(self, value: dict) -> None:
        self.charts_json = json.dumps(value, default=str)

    @property
    def primary_metric(self) -> dict:
        """The headline number shown on cards and lists."""
        metrics = self.metrics
        if self.task_type == "classification":
            return {"label": "Accuracy", "value": metrics.get("accuracy")}
        return {"label": "R² score", "value": metrics.get("r2")}

    def to_dict(self, detailed: bool = False) -> dict:
        data = {
            "id": self.id,
            "name": self.name,
            "dataset_id": self.dataset_id,
            "dataset_name": self.dataset.name if self.dataset else None,
            "task_type": self.task_type,
            "algorithm": self.algorithm,
            "target_column": self.target_column,
            "status": self.status,
            "error_message": self.error_message,
            "duration_ms": self.duration_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "primary_metric": self.primary_metric,
            "metrics": self.metrics,
            "has_artifact": bool(self.artifact_path),
        }
        if detailed:
            data.update(
                {
                    "feature_columns": self.feature_columns,
                    "params": self.params,
                    "charts": self.charts,
                }
            )
        return data
