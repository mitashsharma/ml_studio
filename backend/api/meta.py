"""Catalogue + workspace overview endpoints."""

from __future__ import annotations

from flask import Blueprint, jsonify
from sqlalchemy import func

from ..extensions import db
from ..ml import catalogue
from ..models import Dataset, Experiment
from ..security import current_user, login_required

bp = Blueprint("meta", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "ml-studio", "version": "2.0.0"})


@bp.get("/algorithms")
def algorithms():
    return jsonify(catalogue())


@bp.get("/overview")
@login_required
def overview():
    user = current_user()

    dataset_count = Dataset.query.filter_by(user_id=user.id).count()
    experiments = (
        Experiment.query.filter_by(user_id=user.id)
        .order_by(Experiment.created_at.desc())
        .all()
    )
    successful = [e for e in experiments if e.status == "success"]

    total_rows = (
        db.session.query(func.coalesce(func.sum(Dataset.n_rows), 0))
        .filter(Dataset.user_id == user.id)
        .scalar()
    )

    def score(exp: Experiment) -> float:
        value = exp.primary_metric.get("value")
        return float(value) if isinstance(value, (int, float)) else -999.0

    best = max(successful, key=score) if successful else None

    history = [
        {
            "id": e.id,
            "name": e.name,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "task_type": e.task_type,
            "algorithm": e.algorithm,
            "score": e.primary_metric.get("value"),
            "metric": e.primary_metric.get("label"),
        }
        for e in reversed(successful[:12])
    ]

    by_task: dict[str, int] = {}
    for e in experiments:
        by_task[e.task_type] = by_task.get(e.task_type, 0) + 1

    return jsonify(
        {
            "dataset_count": dataset_count,
            "experiment_count": len(experiments),
            "success_count": len(successful),
            "failed_count": sum(1 for e in experiments if e.status == "failed"),
            "total_rows": int(total_rows or 0),
            "best_experiment": best.to_dict() if best else None,
            "recent_experiments": [e.to_dict() for e in experiments[:5]],
            "recent_datasets": [
                d.to_dict()
                for d in Dataset.query.filter_by(user_id=user.id)
                .order_by(Dataset.created_at.desc())
                .limit(5)
                .all()
            ],
            "score_history": history,
            "task_breakdown": [{"task": k, "count": v} for k, v in by_task.items()],
        }
    )
