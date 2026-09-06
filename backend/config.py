"""Application configuration objects."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
INSTANCE_DIR = BASE_DIR / "instance"


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    """Base configuration shared by every environment."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "ml-studio-dev-secret-change-me-in-production")

    # --- Storage -----------------------------------------------------------
    INSTANCE_DIR = INSTANCE_DIR
    UPLOAD_FOLDER = Path(os.environ.get("UPLOAD_FOLDER", INSTANCE_DIR / "uploads"))
    ARTIFACT_FOLDER = Path(os.environ.get("ARTIFACT_FOLDER", INSTANCE_DIR / "artifacts"))
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_UPLOAD_MB", 32)) * 1024 * 1024
    ALLOWED_EXTENSIONS = {".csv", ".tsv", ".xlsx", ".xls", ".json"}

    # --- Database ----------------------------------------------------------
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{INSTANCE_DIR / 'mlstudio.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- Auth --------------------------------------------------------------
    JWT_SECRET = os.environ.get("JWT_SECRET", SECRET_KEY)
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRES_HOURS = int(os.environ.get("JWT_EXPIRES_HOURS", 24 * 7))

    # --- Training limits ---------------------------------------------------
    MAX_TRAINING_ROWS = int(os.environ.get("MAX_TRAINING_ROWS", 200_000))
    JSON_SORT_KEYS = False


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config(name: str | None = None):
    name = name or os.environ.get("FLASK_ENV", "development")
    return CONFIG_MAP.get(name, DevelopmentConfig)
