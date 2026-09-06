"""A narrated end-to-end demo of the ML Studio API.

Runs against a live server (default http://localhost:5000) and walks through the
exact flow the web UI performs: sign up, import data, profile it, train a
classifier and a regressor, inspect the metrics, score new records and download
the fitted model.

Usage:
    python run.py                 # in one terminal
    python scripts/demo_run.py    # in another

    BASE_URL=http://localhost:5173 python scripts/demo_run.py   # through the UI proxy
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = os.environ.get("BASE_URL", "http://localhost:5000").rstrip("/")
TOKEN: str | None = None

BOLD, DIM, CYAN, GREEN, YELLOW, RESET = (
    "\033[1m",
    "\033[2m",
    "\033[36m",
    "\033[32m",
    "\033[33m",
    "\033[0m",
)


# --------------------------------------------------------------------------- #
# tiny HTTP helper (stdlib only)
# --------------------------------------------------------------------------- #
def call(method: str, path: str, payload: dict | None = None, raw: bool = False):
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    if payload is not None:
        request.add_header("Content-Type", "application/json")
    if TOKEN:
        request.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(request) as response:
            body = response.read()
            return body if raw else json.loads(body)
    except urllib.error.HTTPError as error:
        detail = error.read().decode()
        raise SystemExit(f"{method} {path} failed ({error.code}): {detail}")
    except urllib.error.URLError as error:
        raise SystemExit(f"Cannot reach {BASE_URL} — is the server running? ({error.reason})")


def step(number: int, title: str) -> None:
    print(f"\n{BOLD}{CYAN}▸ Step {number} · {title}{RESET}")


def kv(label: str, value, indent: int = 2) -> None:
    print(f"{' ' * indent}{DIM}{label:<22}{RESET}{value}")


def bar(value: float, width: int = 28, char: str = "█") -> str:
    filled = int(round(max(0.0, min(1.0, value)) * width))
    return f"{GREEN}{char * filled}{DIM}{'·' * (width - filled)}{RESET}"


# --------------------------------------------------------------------------- #
# demo
# --------------------------------------------------------------------------- #
def main() -> None:
    global TOKEN

    print(f"{BOLD}🤖 ML Studio — end-to-end demo{RESET}")
    print(f"{DIM}   server: {BASE_URL}{RESET}")

    # 1 ── health -----------------------------------------------------------
    step(1, "Health check")
    health = call("GET", "/api/health")
    kv("service", health["service"])
    kv("version", health["version"])
    kv("status", f"{GREEN}{health['status']}{RESET}")

    # 2 ── account ----------------------------------------------------------
    step(2, "Create an account (JWT auth)")
    email = f"demo+{int(time.time())}@mlstudio.dev"
    auth = call(
        "POST",
        "/api/auth/register",
        {"username": "Demo Run", "email": email, "password": "demo12345"},
    )
    TOKEN = auth["token"]
    kv("email", email)
    kv("token", auth["token"][:38] + "…")
    kv("expires", auth["expires_at"])

    # 3 ── data -------------------------------------------------------------
    step(3, "Import a dataset (customer churn) and profile it")
    dataset = call("POST", "/api/datasets/samples/customer_churn")["dataset"]
    profile = dataset["profile"]
    kv("dataset", f"{dataset['name']} (id={dataset['id']})")
    kv("shape", f"{dataset['n_rows']} rows × {dataset['n_columns']} columns")
    kv("missing cells", f"{profile['missing_pct']}%")
    kv("duplicate rows", profile["duplicate_rows"])
    kv("quality score", f"{profile['quality_score']}/100  {bar(profile['quality_score'] / 100)}")
    print(f"  {DIM}columns{RESET}")
    for column in profile["columns"]:
        print(
            f"    {column['name']:<20} {DIM}{column['type']:<12}{RESET}"
            f"{column['unique']:>5} unique  {column['missing_pct']:>5}% missing"
            f"  {DIM}→ {column['suggested_task']}{RESET}"
        )
    top = profile["correlations"][0]
    kv("top correlation", f"{top['a']} ↔ {top['b']} = {top['value']}")

    # 4 ── train classifier -------------------------------------------------
    step(4, "Train a classifier (gradient boosting + 5-fold CV)")
    started = time.time()
    experiment = call(
        "POST",
        "/api/experiments",
        {
            "dataset_id": dataset["id"],
            "target_column": "churn",
            "algorithm": "gradient_boosting_classifier",
            "cross_validation": True,
            "test_size": 0.2,
        },
    )["experiment"]
    metrics, charts = experiment["metrics"], experiment["charts"]
    kv("experiment", f"{experiment['name']} (id={experiment['id']})")
    kv("task detected", experiment["task_type"])
    kv("train / test rows", f"{metrics['train_rows']} / {metrics['test_rows']}")
    kv("wall clock", f"{time.time() - started:.2f}s (server: {experiment['duration_ms']} ms)")
    print()
    for key, label in [
        ("accuracy", "Accuracy"),
        ("f1", "F1 (weighted)"),
        ("precision", "Precision"),
        ("recall", "Recall"),
        ("roc_auc", "ROC AUC"),
    ]:
        value = metrics.get(key)
        if value is not None:
            print(f"  {label:<16}{bar(value)} {BOLD}{value:.3f}{RESET}")
    kv("cross-validation", f"{metrics['cv_mean']:.3f} ± {metrics['cv_std']:.3f}")

    # 5 ── evaluation details ----------------------------------------------
    step(5, "Confusion matrix and feature importance")
    matrix = charts["confusion_matrix"]
    labels = matrix["labels"]
    header = "".join(f"{l:>12}" for l in labels)
    print(f"  {DIM}true \\ predicted{RESET}{header}")
    for row_label, row in zip(labels, matrix["matrix"]):
        cells = "".join(f"{value:>12}" for value in row)
        print(f"  {row_label:<16}{cells}")
    print()
    for item in charts["feature_importance"][:6]:
        print(
            f"  {item['feature']:<20}{bar(item['importance'] / 100)} {BOLD}{item['importance']:>5.1f}%{RESET}"
        )

    # 6 ── live prediction --------------------------------------------------
    step(6, "Score new customers with the trained model")
    schema = call("GET", f"/api/experiments/{experiment['id']}/schema")
    kv("model expects", ", ".join(f["name"] for f in schema["features"]))

    risky = {
        "tenure_months": 3,
        "monthly_charges": 119.0,
        "contract": "month-to-month",
        "tech_support": "no",
        "internet_service": "fiber",
        "support_tickets": 4,
        "total_charges": 357.0,
    }
    loyal = {
        "tenure_months": 63,
        "monthly_charges": 42.0,
        "contract": "two-year",
        "tech_support": "yes",
        "internet_service": "dsl",
        "support_tickets": 0,
        "total_charges": 2646.0,
    }
    result = call("POST", f"/api/experiments/{experiment['id']}/predict", {"rows": [risky, loyal]})
    for name, row, prediction, probabilities in zip(
        ["new fiber customer", "long-term customer"],
        [risky, loyal],
        result["predictions"],
        result["probabilities"],
    ):
        top_probability = probabilities[0]
        print(
            f"\n  {BOLD}{name}{RESET} {DIM}(tenure {row['tenure_months']}m, "
            f"${row['monthly_charges']}/mo, {row['contract']}){RESET}"
        )
        print(f"    prediction  {BOLD}{YELLOW}{prediction}{RESET}")
        for probability in probabilities:
            print(
                f"    {probability['label']:<12}{bar(probability['probability'], 20)}"
                f" {probability['probability'] * 100:5.1f}%"
            )
        assert top_probability

    # 7 ── regression -------------------------------------------------------
    step(7, "Same flow for a regression problem (house prices)")
    houses = call("POST", "/api/datasets/samples/house_prices")["dataset"]
    regression = call(
        "POST",
        "/api/experiments",
        {
            "dataset_id": houses["id"],
            "target_column": "price_usd",
            "algorithm": "gradient_boosting_regressor",
        },
    )["experiment"]
    rmetrics = regression["metrics"]
    kv("dataset", f"{houses['name']} — {houses['n_rows']} rows (has missing values + text columns)")
    kv("task detected", regression["task_type"])
    kv("R² score", f"{rmetrics['r2']:.3f}  {bar(rmetrics['r2'])}")
    kv("RMSE", f"${rmetrics['rmse']:,.0f}")
    kv("MAE", f"${rmetrics['mae']:,.0f}")
    kv("MAPE", f"{rmetrics['mape']}%")
    kv("target mean", f"${rmetrics['target_mean']:,.0f}")

    house = {
        "neighbourhood": "Marina",
        "area_sqm": 180,
        "bedrooms": 4,
        "bathrooms": 2,
        "age_years": 6,
        "garage": "yes",
        "condition": "excellent",
    }
    price = call("POST", f"/api/experiments/{regression['id']}/predict", {"row": house})
    kv("sample home", "180 m², 4 bed, Marina, excellent condition")
    kv("predicted price", f"{BOLD}{YELLOW}${price['predictions'][0]:,.0f}{RESET}")

    # 8 ── artefacts + workspace -------------------------------------------
    step(8, "Download the fitted pipeline and read the workspace summary")
    blob = call("GET", f"/api/experiments/{experiment['id']}/download", raw=True)
    output = Path("demo_model.joblib")
    output.write_bytes(blob)
    kv("saved", f"{output} ({len(blob) / 1024:.1f} KB)")

    overview = call("GET", "/api/overview")
    kv("datasets", overview["dataset_count"])
    kv("experiments", overview["experiment_count"])
    kv("rows analysed", f"{overview['total_rows']:,}")
    best = overview["best_experiment"]
    kv("best model", f"{best['name']} — {best['primary_metric']['label']} {best['primary_metric']['value']}")

    print(f"\n{GREEN}{BOLD}✅ Demo complete.{RESET} Everything above is what the UI shows visually.")
    print(f"{DIM}   Sign in at the web app with {email} / demo12345 to see these runs.{RESET}\n")


if __name__ == "__main__":
    main()
