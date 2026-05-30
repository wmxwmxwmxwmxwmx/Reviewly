"""Pull request sync orchestration (OAuth token or installation)."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import AuthUser, Repository
from app.github.pull_requests import fetch_pull_request_diff, fetch_repo_pull_requests
from app.github.sync import _map_pr, _persist_pull_request
from app.repositories import pull_requests as pr_repo
from app.repositories import auth_users as auth_users_repo
from app.services.activity_log import record_activity

logger = logging.getLogger(__name__)


async def _persist_pr_with_token(
    session: Session,
    *,
    gh_repo: dict[str, Any],
    gh_pr: dict[str, Any],
    owner: str,
    name: str,
    token: str,
    owner_user_id: str | None = None,
) -> tuple[str, bool]:
    patch = await fetch_pull_request_diff(owner, name, gh_pr["number"], token)
    pr_id = f"pr-{gh_pr['id']}"
    existing = pr_repo.get_pull_request(session, pr_id)
    created = existing is None
    await _persist_pull_request(
        session,
        gh_pr=gh_pr,
        gh_repo=gh_repo,
        owner=owner,
        name=name,
        installation_id=None,
        patch=patch,
        owner_user_id=owner_user_id,
    )
    return pr_id, created


async def sync_repository_pull_requests(
    session: Session,
    repo_row: Repository,
    *,
    token: str,
    actor: str = "system",
    enqueue_analysis: bool = True,
) -> dict[str, int]:
    owner = repo_row.owner or ""
    name = repo_row.name or ""
    if not owner or not name:
        if "/" in repo_row.full_name:
            owner, name = repo_row.full_name.split("/", 1)
    if not owner or not name:
        return {"synced": 0, "created": 0, "updated": 0}

    gh_prs = await fetch_repo_pull_requests(owner, name, token, state="open")
    gh_repo = {
        "id": int(repo_row.github_id) if repo_row.github_id else 0,
        "full_name": repo_row.full_name,
        "default_branch": repo_row.default_branch or "main",
    }

    synced = 0
    created = 0
    updated = 0
    new_pr_ids: list[str] = []

    for gh_pr in gh_prs:
        pr_id, was_created = await _persist_pr_with_token(
            session,
            gh_repo=gh_repo,
            gh_pr=gh_pr,
            owner=owner,
            name=name,
            token=token,
            owner_user_id=repo_row.owner_user_id,
        )
        synced += 1
        if was_created:
            created += 1
            new_pr_ids.append(pr_id)
        else:
            updated += 1

    repo_row.open_prs = synced
    session.flush()
    session.commit()

    record_activity(
        session,
        event_type="prs_synced",
        actor=actor,
        action=f"Synced {synced} pull requests for {repo_row.full_name}",
        repo=repo_row.full_name,
    )
    session.commit()

    if enqueue_analysis and new_pr_ids:
        from app.services.analysis_orchestrator import enqueue_analysis_for_pr_ids

        enqueue_analysis_for_pr_ids(new_pr_ids)

    logger.info(
        "Synced PRs for %s: synced=%s created=%s updated=%s",
        repo_row.full_name,
        synced,
        created,
        updated,
    )
    return {"synced": synced, "created": created, "updated": updated, "prIds": new_pr_ids}


async def sync_repository_pull_requests_for_user(
    session: Session,
    repo_row: Repository,
    user: AuthUser,
) -> dict[str, int]:
    token = auth_users_repo.decrypt_token(user.access_token_encrypted)
    if not token:
        from app.core.errors import api_error

        raise api_error("GitHub token missing; sign in again", 401)
    return await sync_repository_pull_requests(
        session,
        repo_row,
        token=token,
        actor=user.username,
        enqueue_analysis=True,
    )


async def sync_from_webhook_pr(
    session: Session,
    payload: dict[str, Any],
    *,
    installation_id: str | None,
) -> str | None:
    """Sync a single PR from webhook payload; returns pr_id."""
    pr_data = payload.get("pull_request") or {}
    repo_data = payload.get("repository") or {}
    owner = (repo_data.get("owner") or {}).get("login", "")
    name = repo_data.get("name", "")
    number = pr_data.get("number")
    if not owner or not name or number is None:
        return None

    if installation_id:
        from app.github.sync import sync_single_pull_request

        return await sync_single_pull_request(
            session, owner, name, int(number), installation_id=installation_id
        )

    from app.github import public_client

    return await sync_single_pull_request_public_wrapper(session, owner, name, int(number))


async def sync_single_pull_request_public_wrapper(
    session: Session,
    owner: str,
    repo: str,
    number: int,
) -> str:
    from app.github.sync import sync_single_pull_request_public

    return await sync_single_pull_request_public(session, owner, repo, number)
