"""ML Studio — application factory.

Creates the Flask app, wires extensions, registers the JSON API and (in
production) serves the compiled React front end from ``frontend/dist``.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from .api import BLUEPRINTS
from .config import BASE_DIR, get_config
from .extensions import cors, db
from .security import ApiError

FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

__version__ = "2.0.0"


def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.from_object(get_config(config_name))

    _ensure_directories(app)

    db.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": os.environ.get("CORS_ORIGINS", "*")}})

    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)

    _register_error_handlers(app)
    _register_frontend(app)

    with app.app_context():
        db.create_all()

    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    app.logger.info("ML Studio %s ready", __version__)
    return app


def _ensure_directories(app: Flask) -> None:
    for key in ("INSTANCE_DIR", "UPLOAD_FOLDER", "ARTIFACT_FOLDER"):
        Path(app.config[key]).mkdir(parents=True, exist_ok=True)


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def handle_api_error(error: ApiError):
        return jsonify(error.to_dict()), error.status

    @app.errorhandler(RequestEntityTooLarge)
    def handle_too_large(_error):
        limit = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return jsonify({"error": f"That file is larger than the {limit} MB upload limit."}), 413

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        return jsonify({"error": error.description}), error.code

    @app.errorhandler(Exception)
    def handle_unexpected(error: Exception):  # pragma: no cover - safety net
        app.logger.exception("Unhandled error")
        return jsonify({"error": "Something went wrong on our side.", "detail": str(error)}), 500


def _register_frontend(app: Flask) -> None:
    """Serve the built SPA; unknown paths fall back to index.html."""

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def serve_spa(path: str):
        if path.startswith("api/"):
            return jsonify({"error": "Endpoint not found."}), 404

        if FRONTEND_DIST.exists():
            candidate = FRONTEND_DIST / path
            if path and candidate.is_file():
                return send_from_directory(FRONTEND_DIST, path)
            return send_from_directory(FRONTEND_DIST, "index.html")

        return (
            jsonify(
                {
                    "service": "ML Studio API",
                    "version": __version__,
                    "message": (
                        "The front end has not been built yet. Run 'npm install && npm run dev' "
                        "inside ./frontend for development, or 'npm run build' to serve it here."
                    ),
                    "docs": "/api/health",
                }
            ),
            200,
        )
