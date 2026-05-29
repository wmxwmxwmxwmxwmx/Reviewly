"""JWT authentication for platform users."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.db.deps import get_db
from app.db.models import AuthUser
from app.repositories import auth_users as auth_users_repo

ALGORITHM = "HS256"


def _jwt_secret() -> str:
    secret = settings.jwt_secret.strip()
    if not secret:
        if settings.prism_auth_bypass or settings.debug:
            return "prism-dev-jwt-secret-change-in-production"
        raise api_error("JWT_SECRET not configured", 500)
    return secret


def create_access_token(*, user_id: str, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": user_id,
        "username": username,
        "exp": expire,
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise api_error("Session expired, please sign in again", 401) from exc
    except jwt.InvalidTokenError as exc:
        raise api_error("Invalid session token", 401) from exc


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def get_optional_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> AuthUser | None:
    if settings.prism_auth_bypass:
        return auth_users_repo.get_or_create_bypass_user(db)
    token = _bearer_token(authorization)
    if not token:
        return None
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        return None
    return auth_users_repo.get_user_row(db, user_id)


def get_current_user(
    user: AuthUser | None = Depends(get_optional_user),
) -> AuthUser:
    if user is None:
        raise api_error("Authentication required", 401)
    return user


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
OptionalUser = Annotated[AuthUser | None, Depends(get_optional_user)]
