from __future__ import annotations

import datetime as dt

from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    datasets = db.relationship(
        "Dataset", back_populates="owner", cascade="all, delete-orphan", lazy="dynamic"
    )
    experiments = db.relationship(
        "Experiment", back_populates="owner", cascade="all, delete-orphan", lazy="dynamic"
    )

    # -- password helpers ---------------------------------------------------
    def set_password(self, raw_password: str) -> None:
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "dataset_count": self.datasets.count(),
            "experiment_count": self.experiments.count(),
        }

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<User {self.email}>"
