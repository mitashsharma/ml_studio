from __future__ import annotations

import json

from ..extensions import db
from .user import utcnow


class Dataset(db.Model):
    """A tabular file uploaded by a user, plus its cached profile."""

    __tablename__ = "datasets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    name = db.Column(db.String(200), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, default=0)
    n_rows = db.Column(db.Integer, default=0)
    n_columns = db.Column(db.Integer, default=0)
    profile_json = db.Column(db.Text, default="{}")
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    owner = db.relationship("User", back_populates="datasets")
    experiments = db.relationship(
        "Experiment", back_populates="dataset", cascade="all, delete-orphan", lazy="dynamic"
    )

    @property
    def profile(self) -> dict:
        try:
            return json.loads(self.profile_json or "{}")
        except json.JSONDecodeError:
            return {}

    @profile.setter
    def profile(self, value: dict) -> None:
        self.profile_json = json.dumps(value, default=str)

    def to_dict(self, include_profile: bool = False) -> dict:
        data = {
            "id": self.id,
            "name": self.name,
            "original_filename": self.original_filename,
            "file_size": self.file_size,
            "n_rows": self.n_rows,
            "n_columns": self.n_columns,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "experiment_count": self.experiments.count(),
        }
        if include_profile:
            data["profile"] = self.profile
        return data
