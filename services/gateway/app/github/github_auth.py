"""Resolve GitHub access tokens for API calls."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories import auth_users as auth_users_repo


def effective_github_token(session: Session, user_id: str | None) -> str | None:
    """OAuth user token → GITHUB_PAT → None (anonymous)."""
    if user_id:
        row = auth_users_repo.get_user_row(session, user_id)
        if row is not None:
            token = auth_users_repo.decrypt_token(row.access_token_encrypted)
            if token:
                return token
    pat = settings.github_pat.strip()
    return pat or None
