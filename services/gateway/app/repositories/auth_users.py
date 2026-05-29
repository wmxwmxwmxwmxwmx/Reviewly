"""Auth user persistence and GitHub token storage."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AuthUser, Team, TeamMembership
from app.services import settings_crypto


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _encrypt_token(token: str) -> str:
    if not settings.settings_encryption_key.strip():
        if settings.debug or settings.prism_auth_bypass:
            return f"plain:{token}"
        raise ValueError("SETTINGS_ENCRYPTION_KEY required to store GitHub tokens")
    return settings_crypto.encrypt_secret(token)


def decrypt_token(blob: str | None) -> str | None:
    if not blob:
        return None
    if blob.startswith("plain:"):
        return blob.removeprefix("plain:")
    if not settings.settings_encryption_key.strip():
        return None
    return settings_crypto.decrypt_secret(blob)


def user_to_api(row: AuthUser) -> dict:
    return {
        "id": row.id,
        "githubId": row.github_id,
        "username": row.username,
        "email": row.email,
        "avatarUrl": row.avatar_url,
        "lastLoginAt": row.last_login_at.isoformat().replace("+00:00", "Z")
        if row.last_login_at
        else None,
    }


def get_user_row(session: Session, user_id: str) -> AuthUser | None:
    return session.get(AuthUser, user_id)


def get_user_by_github_id(session: Session, github_id: str) -> AuthUser | None:
    return session.scalar(select(AuthUser).where(AuthUser.github_id == github_id).limit(1))


def ensure_default_team_membership(session: Session, user_id: str) -> None:
    existing = session.scalar(
        select(TeamMembership).where(TeamMembership.user_id == user_id).limit(1)
    )
    if existing:
        return
    team = session.get(Team, "team-default")
    if team is None:
        session.add(Team(id="team-default", name="Acme Corp"))
        session.flush()
    session.add(TeamMembership(user_id=user_id, team_id="team-default", role="member"))


def upsert_from_github(
    session: Session,
    *,
    github_id: str,
    username: str,
    email: str | None,
    avatar_url: str | None,
    access_token: str,
    refresh_token: str | None = None,
) -> AuthUser:
    row = get_user_by_github_id(session, github_id)
    now = _now()
    if row is None:
        row = AuthUser(
            id=f"usr-{uuid.uuid4().hex[:12]}",
            github_id=github_id,
            username=username,
            email=email,
            avatar_url=avatar_url,
            access_token_encrypted=_encrypt_token(access_token),
            refresh_token_encrypted=_encrypt_token(refresh_token) if refresh_token else None,
            last_login_at=now,
        )
        session.add(row)
    else:
        row.username = username
        row.email = email
        row.avatar_url = avatar_url
        row.access_token_encrypted = _encrypt_token(access_token)
        if refresh_token:
            row.refresh_token_encrypted = _encrypt_token(refresh_token)
        row.last_login_at = now
        row.updated_at = now
    session.flush()
    ensure_default_team_membership(session, row.id)
    return row


def get_team_ids_for_user(session: Session, user_id: str) -> list[str]:
    rows = session.scalars(
        select(TeamMembership.team_id).where(TeamMembership.user_id == user_id)
    ).all()
    return list(rows)


def get_or_create_bypass_user(session: Session) -> AuthUser:
    row = get_user_by_github_id(session, "bypass")
    if row:
        return row
    return upsert_from_github(
        session,
        github_id="bypass",
        username="dev-user",
        email="dev@local",
        avatar_url=None,
        access_token=settings.github_pat or "bypass-token",
    )
