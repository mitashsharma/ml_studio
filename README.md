# 🤖 ML Studio

**Upload a spreadsheet, train a model, ship predictions — no notebooks required.**

ML Studio is a small but complete no-code machine-learning workbench for tabular data. It profiles
your dataset, builds a proper scikit-learn preprocessing pipeline, trains one of 13 algorithms,
explains the result with charts, and lets you score new records live or download the fitted model.

```
Flask + scikit-learn JSON API   ⟷   React + Vite + Tailwind single-page app
```

---

## ✨ What it does

| Area | Features |
| --- | --- |
| **Data** | Drag-and-drop upload (CSV / TSV / Excel / JSON), 5 built-in sample datasets, automatic profiling: dtypes, missing values, uniqueness, histograms, top categories, correlations and a 0–100 quality score |
| **Modelling** | Task auto-detection (classification vs regression), 13 algorithms, tunable hyper-parameters, adjustable test split, optional k-fold cross-validation |
| **Preprocessing** | Median/most-frequent imputation, standardisation, one-hot encoding with unseen-category handling, datetime → numeric — all wrapped in a single reproducible `Pipeline` |
| **Evaluation** | Accuracy / precision / recall / F1 / ROC-AUC / balanced accuracy, confusion matrix, per-class table · R² / RMSE / MAE / MAPE, actual-vs-predicted scatter, residual distribution |
| **Explainability** | Feature importance (native or permutation-based) aggregated back to your original columns |
| **Shipping** | Live prediction form with class probabilities, batch predictions over the API, one-click `.joblib` download |
| **Platform** | JWT auth, per-user data isolation, friendly JSON errors, 12 automated tests |

### Algorithms

*Classification* — Logistic Regression · Random Forest · Gradient Boosting · Decision Tree · K-Nearest Neighbours · SVM
*Regression* — Linear · Ridge · Random Forest · Gradient Boosting · Decision Tree · K-Nearest Neighbours · SVR

---

## 🚀 Quick start

```bash
# 1. Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Frontend
cd frontend && npm install && cd ..

# 3. Run both (API on :5000, UI on :5173)
./dev.sh
```

Open **http://localhost:5173** and create an account.

Want data to play with straight away?

```bash
python scripts/seed_demo.py     # demo@mlstudio.dev / demo12345 + 3 trained models
```

### Single-process mode

Build the front end once and Flask serves everything on port 5000:

```bash
cd frontend && npm run build && cd ..
python run.py            # → http://localhost:5000
```

### Make targets

```bash
make install   # python venv + npm install
make dev       # API + UI with hot reload
make seed      # demo account and sample experiments
make test      # pytest + vitest
make build     # compile the SPA into frontend/dist
make clean     # wipe instance/ (uploads, models, database)
```

---

## 🧭 Using it

1. **Datasets** → drop in a CSV (or import a sample). ML Studio profiles it instantly and shows a
   data-health report: missing values, distributions, correlations, duplicate rows.
2. **Train model** → pick the dataset, pick the column you want to predict (the task type is
   inferred), keep or trim the feature list, choose an algorithm, tweak the split and hyper-parameters.
3. **Experiment page** → read the metrics, confusion matrix or residual plots, see which features
   mattered, then switch to **Live prediction** and score a new record — or download the pipeline.

---

## 🗂 Project structure

```
ml-studio/
├── backend/
│   ├── __init__.py          # app factory, error handlers, SPA hosting
│   ├── config.py            # env-driven configuration objects
│   ├── extensions.py        # SQLAlchemy, CORS
│   ├── security.py          # JWT issuing/validation, @login_required, ApiError
│   ├── models/              # User, Dataset, Experiment (SQLAlchemy)
│   ├── api/                 # auth, datasets, experiments, meta blueprints
│   └── ml/
│       ├── algorithms.py    # algorithm catalogue + hyper-parameter schemas
│       ├── profiling.py     # loading, profiling, task inference
│       └── trainer.py       # pipeline, training, metrics, charts, prediction
├── frontend/
│   └── src/
│       ├── components/      # Layout, AuthShell, UI kit
│       ├── context/         # auth + toast providers
│       ├── lib/             # API client, formatters
│       └── pages/           # Dashboard, Datasets, Train, Experiments, Guide…
├── samples/                 # 5 ready-to-use datasets
├── scripts/seed_demo.py     # demo workspace generator
├── tests/test_api.py        # end-to-end API tests
├── run.py                   # dev entry point
├── dev.sh / Makefile        # convenience runners
└── requirements.txt
```

Runtime data (SQLite database, uploads, model artifacts) lives in `instance/` and is git-ignored.

---

## 🔌 API

Authenticate once, then send `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` · `/api/auth/login` | Get a JWT |
| `GET` | `/api/auth/me` | Current user |
| `GET` `POST` | `/api/datasets` | List / upload datasets |
| `GET` | `/api/datasets/:id` | Metadata + full profile |
| `GET` | `/api/datasets/:id/preview?limit=25` | Rows as JSON |
| `GET` `POST` | `/api/datasets/samples` | List / import sample datasets |
| `GET` | `/api/algorithms` | Catalogue + hyper-parameter schemas |
| `GET` `POST` | `/api/experiments` | List / train |
| `GET` `DELETE` | `/api/experiments/:id` | Detail (metrics + charts) / delete |
| `GET` | `/api/experiments/:id/schema` | Feature schema for prediction forms |
| `POST` | `/api/experiments/:id/predict` | Score `{"row": {...}}` or `{"rows": [...]}` |
| `GET` | `/api/experiments/:id/download` | Fitted pipeline as `.joblib` |
| `GET` | `/api/overview` | Dashboard aggregates |

```bash
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@mlstudio.dev","password":"demo12345"}' | jq -r .token)

curl -s -X POST localhost:5000/api/experiments \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"dataset_id":1,"target_column":"churn","algorithm":"gradient_boosting_classifier","cross_validation":true}' | jq '.experiment.metrics'
```

Reusing a downloaded model is plain scikit-learn:

```python
import joblib, pandas as pd
bundle = joblib.load("churn_risk.joblib")
pred = bundle["pipeline"].predict(pd.DataFrame([{...}])[bundle["features"]])
print(bundle["label_encoder"].inverse_transform(pred))
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env` (loaded via `python-dotenv`) or export the variables:

| Variable | Default | Notes |
| --- | --- | --- |
| `SECRET_KEY` / `JWT_SECRET` | dev values | **Change in production** |
| `DATABASE_URL` | `sqlite:///instance/mlstudio.db` | Any SQLAlchemy URL (e.g. Postgres) |
| `UPLOAD_FOLDER` / `ARTIFACT_FOLDER` | `instance/…` | Where files and models are stored |
| `MAX_UPLOAD_MB` | `32` | Upload size limit |
| `JWT_EXPIRES_HOURS` | `168` | Token lifetime |
| `CORS_ORIGINS` | `*` | Restrict when deploying |

Production run:

```bash
cd frontend && npm run build && cd ..
gunicorn -w 4 -b 0.0.0.0:5000 "backend:create_app()"
```

---

## 🧪 Tests

```bash
make test        # backend (pytest) + front end (vitest)
make test-api    # python -m pytest tests -q
make test-ui     # cd frontend && npm test
```

Backend tests cover registration/validation, auth guards, upload + profiling, classification and regression
training, prediction, cross-user isolation and error handling. Front-end tests render the
dashboard, dataset list, training wizard and experiment report against a mocked API.

---

## 🛣 Ideas for next steps

- Background training queue (Celery/RQ) for large datasets
- Automatic algorithm shoot-out ("train them all, keep the best")
- Model comparison view across experiments
- Time-series splits and forecasting models
- Public REST tokens for serving predictions to other apps

---

Built with Flask, scikit-learn, pandas, React, Vite, Tailwind CSS and Recharts.
