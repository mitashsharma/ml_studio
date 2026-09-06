"""Dataset loading, profiling and preview helpers."""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pandas as pd

CLASSIFICATION = "classification"
REGRESSION = "regression"

MAX_CATEGORY_PREVIEW = 8


def load_dataframe(path: str | Path, nrows: int | None = None) -> pd.DataFrame:
    """Read a tabular file into a DataFrame based on its extension."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix in {".csv", ".txt"}:
        df = pd.read_csv(path, nrows=nrows)
    elif suffix == ".tsv":
        df = pd.read_csv(path, sep="\t", nrows=nrows)
    elif suffix in {".xlsx", ".xls"}:
        df = pd.read_excel(path, nrows=nrows)
    elif suffix == ".json":
        df = pd.read_json(path)
        if nrows:
            df = df.head(nrows)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    # Normalise column names a little without being destructive.
    df.columns = [str(c).strip() for c in df.columns]
    return df


def jsonify_value(value):
    """Convert numpy/pandas scalars into something ``json.dumps`` accepts."""
    if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        f = float(value)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 6)
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if pd.isna(value) if np.isscalar(value) else False:
        return None
    return value


def infer_semantic_type(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    return "categorical"


def suggest_task(series: pd.Series) -> str:
    """Guess whether a target column is a classification or regression target."""
    kind = infer_semantic_type(series)
    non_null = series.dropna()
    n_unique = int(non_null.nunique())

    if kind in {"categorical", "boolean"}:
        return CLASSIFICATION
    if kind != "numeric":
        return CLASSIFICATION
    if n_unique <= 2:
        return CLASSIFICATION

    values = non_null.to_numpy(dtype="float64", copy=False)
    integer_like = pd.api.types.is_integer_dtype(non_null) or bool(np.all(np.mod(values, 1) == 0))
    few_levels = n_unique <= 20 and n_unique <= max(2, 0.2 * len(non_null))
    if integer_like and few_levels:
        return CLASSIFICATION
    return REGRESSION


def profile_column(series: pd.Series, total_rows: int) -> dict:
    kind = infer_semantic_type(series)
    missing = int(series.isna().sum())
    info = {
        "name": str(series.name),
        "dtype": str(series.dtype),
        "type": kind,
        "missing": missing,
        "missing_pct": round(missing / total_rows * 100, 2) if total_rows else 0.0,
        "unique": int(series.nunique(dropna=True)),
        "suggested_task": suggest_task(series),
    }

    if kind == "numeric":
        described = series.describe()
        info["stats"] = {
            "mean": jsonify_value(described.get("mean")),
            "std": jsonify_value(described.get("std")),
            "min": jsonify_value(described.get("min")),
            "p25": jsonify_value(described.get("25%")),
            "median": jsonify_value(described.get("50%")),
            "p75": jsonify_value(described.get("75%")),
            "max": jsonify_value(described.get("max")),
        }
        clean = series.dropna()
        if len(clean) > 1 and clean.nunique() > 1:
            counts, edges = np.histogram(clean.astype(float), bins=min(20, max(5, clean.nunique())))
            info["histogram"] = [
                {"bin": f"{edges[i]:.3g}", "start": float(edges[i]), "count": int(counts[i])}
                for i in range(len(counts))
            ]
    else:
        counts = series.astype("string").value_counts(dropna=True).head(MAX_CATEGORY_PREVIEW)
        info["top_values"] = [
            {"value": str(idx), "count": int(val)} for idx, val in counts.items()
        ]

    return info


def profile_dataframe(df: pd.DataFrame) -> dict:
    total_rows = len(df)
    columns = [profile_column(df[col], total_rows) for col in df.columns]

    numeric_cols = df.select_dtypes(include="number")
    correlations: list[dict] = []
    if numeric_cols.shape[1] >= 2:
        corr = numeric_cols.corr(numeric_only=True)
        cols = list(corr.columns)
        for i, a in enumerate(cols):
            for b in cols[i + 1 :]:
                value = jsonify_value(corr.loc[a, b])
                if value is not None:
                    correlations.append({"a": str(a), "b": str(b), "value": value})
        correlations.sort(key=lambda item: abs(item["value"]), reverse=True)
        correlations = correlations[:15]

    duplicate_rows = int(df.duplicated().sum())
    missing_cells = int(df.isna().sum().sum())
    total_cells = int(total_rows * max(df.shape[1], 1))

    return {
        "n_rows": total_rows,
        "n_columns": int(df.shape[1]),
        "duplicate_rows": duplicate_rows,
        "missing_cells": missing_cells,
        "missing_pct": round(missing_cells / total_cells * 100, 2) if total_cells else 0.0,
        "memory_kb": round(df.memory_usage(deep=True).sum() / 1024, 1),
        "columns": columns,
        "correlations": correlations,
        "quality_score": quality_score(total_rows, total_cells, missing_cells, duplicate_rows),
    }


def quality_score(rows: int, cells: int, missing: int, duplicates: int) -> int:
    """A friendly 0-100 heuristic so users get instant feedback on their data."""
    if not rows or not cells:
        return 0
    score = 100.0
    score -= (missing / cells) * 60
    score -= (duplicates / rows) * 25
    if rows < 50:
        score -= 15
    elif rows < 200:
        score -= 5
    return int(max(0, min(100, round(score))))


def preview_records(df: pd.DataFrame, limit: int = 25) -> dict:
    head = df.head(limit)
    records = []
    for _, row in head.iterrows():
        records.append({str(k): jsonify_value(v) for k, v in row.items()})
    return {"columns": [str(c) for c in df.columns], "rows": records}
