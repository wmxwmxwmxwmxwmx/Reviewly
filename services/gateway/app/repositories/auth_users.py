"""Auth user persistence and GitHub token storage."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AuthUser, Repository, Team, TeamMembership
from app.services import settings_crypto

_GITHUB_USER = "https://api.github.com/user"


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
        "login": row.username,
        "name": row.username,
        "githubId": row.github_id,
        "username": row.username,
        "email": row.email,
        "avatarUrl": row.avatar_url,
        "lastLoginAt": row.last_login_at.isoformat().replace("+00:00", "Z")
        if row.last_login_at
        else None,
    }


def _sync_stats(session: Session, user_id: str) -> tuple[int, str | None]:
    row = session.execute(
        select(
            func.count(Repository.id),
            func.max(Repository.last_synced_at),
        ).where(Repository.owner_user_id == user_id)
    ).one()
    count = int(row[0] or 0)
    last_synced = row[1]
    last_synced_at = (
        last_synced.isoformat().replace("+00:00", "Z") if last_synced else None
    )
    return count, last_synced_at


async def check_token_status(row: AuthUser) -> str:
    token = decrypt_token(row.access_token_encrypted)
    if not token:
        return "missing"
    if settings.prism_auth_bypass and row.github_id == "bypass":
        return "valid"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                _GITHUB_USER,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                },
            )
            if resp.status_code == 200:
                return "valid"
            if resp.status_code == 401:
                return "expired"
    except httpx.HTTPError:
        return "expired"
    return "expired"


async def github_account_to_api(session: Session, row: AuthUser) -> dict:
    synced_repo_count, last_synced_at = _sync_stats(session, row.id)
    token_status = await check_token_status(row)
    return {
        "login": row.username,
        "avatarUrl": row.avatar_url,
        "email": row.email,
        "githubId": row.github_id,
        "syncedRepoCount": synced_repo_count,
        "lastSyncedAt": last_synced_at,
        "tokenStatus": token_status,
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
