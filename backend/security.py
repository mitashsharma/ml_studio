"""Token based authentication helpers.

ML Studio exposes a JSON API consumed by a React front end, so instead of
server-side sessions we issue short lived JWTs that the browser stores and
sends through the ``Authorization: Bearer <token>`` header.
"""

from __future__ import annotations

import datetime as dt
from functools import wraps

import jwt
from flask import current_app, g, request

from .extensions import db
from .models import User


class ApiError(Exception):
    """Raised anywhere in the API to return a clean JSON error."""

    def __init__(self, message: str, status: int = 400, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.details = details or {}

    def to_dict(self) -> dict:
        payload = {"error": self.message}
        if self.details:
            payload["details"] = self.details
        return payload


def create_access_token(user: User) -> tuple[str, str]:
    """Return ``(token, iso_expiry)`` for the given user."""
    expires_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(
        hours=current_app.config["JWT_EXPIRES_HOURS"]
    )
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": dt.datetime.now(dt.timezone.utc),
        "exp": expires_at,
    }
    token = jwt.encode(
        payload,
        current_app.config["JWT_SECRET"],
        algorithm=current_app.config["JWT_ALGORITHM"],
    )
    return token, expires_at.isoformat()


def decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        current_app.config["JWT_SECRET"],
        algorithms=[current_app.config["JWT_ALGORITHM"]],
    )


def _user_from_request() -> User | None:
    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    token = header.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise ApiError("Your session has expired, please sign in again.", 401)
    except jwt.PyJWTError:
        raise ApiError("Invalid authentication token.", 401)
    return db.session.get(User, int(payload["sub"]))


def login_required(view):
    """Attach the authenticated user to ``g.user`` or return 401."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        user = _user_from_request()
        if user is None:
            raise ApiError("Authentication required.", 401)
        g.user = user
        return view(*args, **kwargs)

    return wrapper


def current_user() -> User:
    return g.user
