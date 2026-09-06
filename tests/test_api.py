"""End-to-end API tests: auth → upload → train → predict."""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend import create_app  # noqa: E402
from backend.extensions import db  # noqa: E402


@pytest.fixture()
def app(tmp_path):
    application = create_app("testing")
    application.config.update(
        UPLOAD_FOLDER=tmp_path / "uploads",
        ARTIFACT_FOLDER=tmp_path / "artifacts",
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{tmp_path / 'test.db'}",
    )
    (tmp_path / "uploads").mkdir()
    (tmp_path / "artifacts").mkdir()
    with application.app_context():
        db.drop_all()
        db.create_all()
    yield application


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth(client):
    response = client.post(
        "/api/auth/register",
        json={"username": "Tester", "email": "tester@example.com", "password": "supersecret"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.get_json()['token']}"}


CSV = b"""feature_a,feature_b,category,label
1,2.5,red,yes
2,3.5,blue,no
3,1.5,red,yes
4,5.5,green,no
5,2.2,blue,yes
6,7.1,red,no
7,3.3,green,yes
8,4.4,blue,no
9,6.6,red,yes
10,2.8,green,no
11,3.9,blue,yes
12,5.1,red,no
"""


def test_health(client):
    assert client.get("/api/health").get_json()["status"] == "ok"


def test_algorithms_catalogue(client):
    data = client.get("/api/algorithms").get_json()
    assert len(data["classification"]) >= 5
    assert len(data["regression"]) >= 5


def test_register_validation(client):
    response = client.post("/api/auth/register", json={"username": "x", "email": "bad", "password": "1"})
    assert response.status_code == 422
    assert set(response.get_json()["details"]) == {"username", "email", "password"}


def test_login_and_me(client, auth):
    login = client.post(
        "/api/auth/login", json={"email": "tester@example.com", "password": "supersecret"}
    )
    assert login.status_code == 200
    me = client.get("/api/auth/me", headers=auth)
    assert me.get_json()["user"]["email"] == "tester@example.com"


def test_requires_authentication(client):
    assert client.get("/api/datasets").status_code == 401


def upload(client, auth):
    return client.post(
        "/api/datasets",
        headers=auth,
        data={"file": (io.BytesIO(CSV), "toy.csv")},
        content_type="multipart/form-data",
    )


def test_upload_profiles_dataset(client, auth):
    response = upload(client, auth)
    assert response.status_code == 201
    dataset = response.get_json()["dataset"]
    assert dataset["n_rows"] == 12
    assert dataset["n_columns"] == 4
    profile = dataset["profile"]
    assert profile["quality_score"] > 0
    types = {c["name"]: c["type"] for c in profile["columns"]}
    assert types["feature_b"] == "numeric"
    assert types["category"] == "categorical"


def test_rejects_unsupported_file(client, auth):
    response = client.post(
        "/api/datasets",
        headers=auth,
        data={"file": (io.BytesIO(b"nope"), "notes.pdf")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_train_classification_and_predict(client, auth):
    dataset_id = upload(client, auth).get_json()["dataset"]["id"]

    response = client.post(
        "/api/experiments",
        headers=auth,
        json={
            "dataset_id": dataset_id,
            "target_column": "label",
            "algorithm": "random_forest_classifier",
        },
    )
    assert response.status_code == 201, response.get_json()
    experiment = response.get_json()["experiment"]
    assert experiment["task_type"] == "classification"
    assert experiment["status"] == "success"
    assert 0.0 <= experiment["metrics"]["accuracy"] <= 1.0
    assert experiment["charts"]["confusion_matrix"]["labels"] == ["no", "yes"]
    assert experiment["charts"]["feature_importance"]

    schema = client.get(f"/api/experiments/{experiment['id']}/schema", headers=auth).get_json()
    row = {f["name"]: f["default"] for f in schema["features"]}

    prediction = client.post(
        f"/api/experiments/{experiment['id']}/predict", headers=auth, json={"row": row}
    ).get_json()
    assert prediction["predictions"][0] in {"yes", "no"}
    assert prediction["probabilities"][0][0]["probability"] >= 0


def test_train_regression(client, auth):
    dataset_id = upload(client, auth).get_json()["dataset"]["id"]
    response = client.post(
        "/api/experiments",
        headers=auth,
        json={
            "dataset_id": dataset_id,
            "target_column": "feature_b",
            "task_type": "regression",
            "algorithm": "linear_regression",
        },
    )
    assert response.status_code == 201, response.get_json()
    experiment = response.get_json()["experiment"]
    assert "r2" in experiment["metrics"]
    assert experiment["charts"]["actual_vs_predicted"]


def test_bad_target_returns_friendly_error(client, auth):
    dataset_id = upload(client, auth).get_json()["dataset"]["id"]
    response = client.post(
        "/api/experiments",
        headers=auth,
        json={"dataset_id": dataset_id, "target_column": "nope"},
    )
    assert response.status_code == 422
    assert "not a column" in response.get_json()["error"]


def test_users_cannot_see_each_others_data(client, auth):
    dataset_id = upload(client, auth).get_json()["dataset"]["id"]
    other = client.post(
        "/api/auth/register",
        json={"username": "Mallory", "email": "mallory@example.com", "password": "supersecret"},
    ).get_json()
    headers = {"Authorization": f"Bearer {other['token']}"}
    assert client.get(f"/api/datasets/{dataset_id}", headers=headers).status_code == 404


def test_overview_counts(client, auth):
    upload(client, auth)
    data = client.get("/api/overview", headers=auth).get_json()
    assert data["dataset_count"] == 1
    assert data["experiment_count"] == 0
