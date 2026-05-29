"""Sync repository metadata from GitHub (no clone, no PR diffs)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.db.models import AuthUser, Repository
from app.github import public_client
from app.github.client import GitHubClient
from app.github.repo_mapper import github_repo_to_metadata
from app.github.repositories import fetch_repo_by_url, fetch_user_repositories
from app.repositories import auth_users as auth_users_repo
from app.repositories import repos as repos_repo
from app.services.activity_log import record_activity

logger = logging.getLogger(__name__)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _user_token(user: AuthUser) -> str:
    token = auth_users_repo.decrypt_token(user.access_token_encrypted)
    if not token:
        raise api_error("GitHub token missing for user; sign in again", 401)
    return token


async def import_repository_from_url(
    session: Session,
    url: str,
    *,
    user: AuthUser | None = None,
) -> dict:
    token = _user_token(user) if user else None
    gh_repo = await fetch_repo_by_url(url, token)
    owner = (gh_repo.get("owner") or {}).get("login", "")
    name = gh_repo.get("name", "")
    open_prs = 0
    if owner and name and token:
        try:
            from app.github.pull_requests import fetch_repo_pull_requests

            prs = await fetch_repo_pull_requests(owner, name, token, state="open")
            open_prs = len(prs)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not fetch open PRs for %s/%s: %s", owner, name, exc)
    elif owner and name:
        try:
            prs = await public_client.list_open_pull_requests(owner, name)
            open_prs = len(prs)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not fetch open PRs for %s/%s: %s", owner, name, exc)

    team_ids = auth_users_repo.get_team_ids_for_user(session, user.id) if user else []
    metadata = github_repo_to_metadata(
        gh_repo,
        open_prs=open_prs,
        last_synced_at=_now_utc(),
    )
    metadata["owner_user_id"] = user.id if user else None
    metadata["visibility"] = "private"
    metadata["source"] = "oauth" if user else "pat"
    if team_ids:
        metadata["team_id"] = team_ids[0]

    row, created = repos_repo.upsert_repository(session, metadata)
    session.commit()
    if user:
        record_activity(
            session,
            event_type="repo_imported",
            actor=user.username,
            action=f"Imported repository {metadata['full_name']}",
            repo=metadata["full_name"],
        )
        session.commit()
    logger.info("Imported repository %s (created=%s)", metadata["full_name"], created)
    dto = repos_repo.get_repo(session, row.id)
    if dto is None:
        raise api_error("Failed to persist repository", 500)
    return dto


async def sync_repositories_for_user(session: Session, user: AuthUser) -> dict[str, Any]:
    token = _user_token(user)
    gh_repos = await fetch_user_repositories(token)
    team_ids = auth_users_repo.get_team_ids_for_user(session, user.id)
    synced = 0
    created = 0
    updated = 0
    last_synced = _now_utc()

    for gh_repo in gh_repos:
        full_name = gh_repo.get("full_name") or ""
        if not full_name:
            continue
        metadata = github_repo_to_metadata(
            gh_repo,
            open_prs=0,
            last_synced_at=last_synced,
        )
        metadata["owner_user_id"] = user.id
        metadata["visibility"] = "private"
        metadata["source"] = "oauth"
        if team_ids:
            metadata["team_id"] = team_ids[0]
        _, was_created = repos_repo.upsert_repository(session, metadata)
        synced += 1
        if was_created:
            created += 1
        else:
            updated += 1

    session.commit()
    record_activity(
        session,
        event_type="repos_synced",
        actor=user.username,
        action=f"Synced {synced} repositories from GitHub",
        repo="",
    )
    session.commit()
    logger.info(
        "User %s synced repos: synced=%s created=%s updated=%s",
        user.username,
        synced,
        created,
        updated,
    )
    return {
        "synced": synced,
        "created": created,
        "updated": updated,
        "status": "ok",
        "syncedRepos": synced,
    }


async def sync_github_repositories(session: Session) -> dict[str, Any]:
    if not settings.github_pat.strip():
        if settings.github_app_id and settings.github_app_private_key:
            return await _sync_via_installations(session)
        raise api_error("GitHub PAT not configured", 500)

    gh_repos = await fetch_user_repositories()
    synced = 0
    created = 0
    updated = 0
    last_synced = _now_utc()

    for gh_repo in gh_repos:
        full_name = gh_repo.get("full_name") or ""
        if not full_name:
            continue
        metadata = github_repo_to_metadata(
            gh_repo,
            open_prs=0,
            last_synced_at=last_synced,
        )
        metadata["source"] = "pat"
        _, was_created = repos_repo.upsert_repository(session, metadata)
        synced += 1
        if was_created:
            created += 1
        else:
            updated += 1

    session.commit()
    return {
        "synced": synced,
        "created": created,
        "updated": updated,
        "status": "ok",
        "syncedRepos": synced,
    }


async def _sync_via_installations(session: Session) -> dict[str, Any]:
    rows = session.scalars(
        select(Repository.installation_id)
        .where(Repository.installation_id.isnot(None))
        .distinct()
    ).all()
    installation_ids = [i for i in rows if i]
    if not installation_ids:
        raise api_error("GitHub PAT not configured", 500)

    synced = 0
    created = 0
    updated = 0
    last_synced = _now_utc()

    for inst_id in installation_ids:
        client = GitHubClient(inst_id)
        gh_repos = await client.list_repos()
        for gh_repo in gh_repos:
            metadata = github_repo_to_metadata(
                gh_repo,
                open_prs=0,
                last_synced_at=last_synced,
                installation_id=inst_id,
            )
            metadata["source"] = "webhook"
            _, was_created = repos_repo.upsert_repository(
                session,
                metadata,
                installation_id=inst_id,
            )
            synced += 1
            if was_created:
                created += 1
            else:
                updated += 1

    session.commit()
    return {
        "synced": synced,
        "created": created,
        "updated": updated,
        "status": "ok",
        "syncedRepos": synced,
    }


async def sync_repositories_metadata(session: Session) -> dict[str, Any]:
    return await sync_github_repositories(session)
