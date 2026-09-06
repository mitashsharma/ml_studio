"""Seed a demo workspace so you can click around immediately.

Usage:  python scripts/seed_demo.py
Creates demo@mlstudio.dev / demo12345 with sample datasets and trained models.
"""

from __future__ import annotations

import shutil
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend import create_app  # noqa: E402
from backend.extensions import db  # noqa: E402
from backend.ml import load_dataframe, profile_dataframe, train  # noqa: E402
from backend.models import Dataset, Experiment, User  # noqa: E402

DEMO_EMAIL = "demo@mlstudio.dev"
DEMO_PASSWORD = "demo12345"

PLAN = [
    ("customer_churn", "churn", "gradient_boosting_classifier", "Churn risk · Gradient Boosting"),
    ("house_prices", "price_usd", "random_forest_regressor", "House prices · Random Forest"),
    ("iris_flowers", "species", "logistic_regression", "Iris species · Logistic Regression"),
]


def main() -> None:
    app = create_app()
    with app.app_context():
        user = User.query.filter_by(email=DEMO_EMAIL).first()
        if user is None:
            user = User(username="Demo Analyst", email=DEMO_EMAIL)
            user.set_password(DEMO_PASSWORD)
            db.session.add(user)
            db.session.commit()
            print(f"✅ created user {DEMO_EMAIL} (password: {DEMO_PASSWORD})")
        else:
            print(f"ℹ️  user {DEMO_EMAIL} already exists")

        upload_dir = Path(app.config["UPLOAD_FOLDER"]) / str(user.id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        for key, target, algorithm, name in PLAN:
            source = ROOT / "samples" / f"{key}.csv"
            if not source.exists():
                print(f"⚠️  missing sample {source}")
                continue

            dataset = Dataset.query.filter_by(user_id=user.id, original_filename=source.name).first()
            if dataset is None:
                stored = f"{uuid.uuid4().hex}.csv"
                shutil.copyfile(source, upload_dir / stored)
                df = load_dataframe(upload_dir / stored)
                dataset = Dataset(
                    user_id=user.id,
                    name=key.replace("_", " ").title(),
                    original_filename=source.name,
                    stored_filename=stored,
                    file_size=source.stat().st_size,
                    n_rows=len(df),
                    n_columns=df.shape[1],
                )
                dataset.profile = profile_dataframe(df)
                db.session.add(dataset)
                db.session.commit()
                print(f"📁 imported dataset '{dataset.name}'")

            if Experiment.query.filter_by(user_id=user.id, dataset_id=dataset.id).count():
                continue

            df = load_dataframe(upload_dir / dataset.stored_filename)
            features = [c for c in df.columns if c != target]
            experiment = Experiment(
                user_id=user.id,
                dataset_id=dataset.id,
                name=name,
                task_type="classification",
                algorithm=algorithm,
                target_column=target,
                status="running",
            )
            experiment.feature_columns = features
            db.session.add(experiment)
            db.session.commit()

            artifact = (
                Path(app.config["ARTIFACT_FOLDER"])
                / str(user.id)
                / f"experiment_{experiment.id}.joblib"
            )
            result = train(
                df=df,
                target=target,
                features=features,
                algorithm_key=algorithm,
                cross_validation=True,
                artifact_path=artifact,
            )
            experiment.status = "success"
            experiment.task_type = result.task_type
            experiment.metrics = result.metrics
            experiment.charts = result.charts
            experiment.params = result.params
            experiment.duration_ms = result.duration_ms
            experiment.artifact_path = result.artifact_path
            db.session.commit()
            metric = experiment.primary_metric
            print(f"🧠 trained '{name}' → {metric['label']} {metric['value']}")

    print("\n🎉 Demo workspace ready — sign in with", DEMO_EMAIL, "/", DEMO_PASSWORD)


if __name__ == "__main__":
    main()
