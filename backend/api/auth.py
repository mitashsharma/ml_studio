"""Authentication endpoints."""

from __future__ import annotations

import re

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import User
from ..security import ApiError, create_access_token, current_user, login_required

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    errors = {}
    if len(username) < 2:
        errors["username"] = "Please use at least 2 characters."
    if not EMAIL_RE.match(email):
        errors["email"] = "Enter a valid email address."
    if len(password) < 8:
        errors["password"] = "Passwords must be at least 8 characters."
    if errors:
        raise ApiError("Please fix the highlighted fields.", 422, errors)

    if User.query.filter_by(email=email).first():
        raise ApiError("That email is already registered.", 409, {"email": "Already registered."})

    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token, expires_at = create_access_token(user)
    return jsonify({"token": token, "expires_at": expires_at, "user": user.to_dict()}), 201


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if user is None or not user.check_password(password):
        raise ApiError("Incorrect email or password.", 401)

    token, expires_at = create_access_token(user)
    return jsonify({"token": token, "expires_at": expires_at, "user": user.to_dict()})


@bp.get("/me")
@login_required
def me():
    return jsonify({"user": current_user().to_dict()})
