"""Pull request sync orchestration (OAuth token or installation)."""
from __future__ import annotations

import asyncio
import logging
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuthUser, PullRequest, Repository
from app.github.pull_requests import fetch_pull_request_diff, fetch_repo_pull_requests
from app.github.sync import _map_pr, _persist_pull_request
from app.repositories import auth_users as auth_users_repo
from app.repositories import pull_requests as pr_repo
from app.repositories import repos as repos_repo
from app.repositories.repo_management import repository_is_managed
from app.services.activity_log import record_activity
from app.services.analysis_cache import extract_shas_from_github_pr

if TYPE_CHECKING:
    from starlette.requests import Request

logger = logging.getLogger(__name__)

RECONCILE_HARD_WINDOW = timedelta(minutes=2)
_repo_sync_locks: dict[str, asyncio.Lock] = {}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _lock_for(repo_id: str) -> asyncio.Lock:
    if repo_id not in _repo_sync_locks:
        _repo_sync_locks[repo_id] = asyncio.Lock()
    return _repo_sync_locks[repo_id]


def _resolve_owner_name(repo_row: Repository) -> tuple[str, str]:
    owner = repo_row.owner or ""
    name = repo_row.name or ""
    if not owner or not name:
        if "/" in repo_row.full_name:
            owner, name = repo_row.full_name.split("/", 1)
    return owner, name


def _should_hard_reconcile(repo_row: Repository, *, force_reconcile: bool) -> bool:
    if force_reconcile:
        return True
    last = repo_row.last_synced_at
    if last is None:
        return False
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return _now_utc() - last > RECONCILE_HARD_WINDOW


def reconcile_soft_pull_requests(
    session: Session,
    repository_id: str,
    open_numbers: set[int],
) -> int:
    """Mark DB-open PRs missing from GitHub as stale (needs revisit), do not close."""
    marked = 0
    rows = session.scalars(
        select(PullRequest).where(
            PullRequest.repository_id == repository_id,
            PullRequest.state == "open",
        )
    ).all()
    for row in rows:
        if row.number in open_numbers:
            continue
        payload = deepcopy(row.payload) if row.payload else {}
        payload["syncStaleAt"] = _now_utc().isoformat()
        row.payload = payload
        marked += 1
    if marked:
        session.flush()
    return marked


def reconcile_closed_pull_requests(
    session: Session,
    repository_id: str,
    open_numbers: set[int],
) -> int:
    """Hard reconcile: close DB-open PRs not present in GitHub open list."""
    closed = 0
    rows = session.scalars(
        select(PullRequest).where(
            PullRequest.repository_id == repository_id,
            PullRequest.state == "open",
        )
    ).all()
    for row in rows:
        if row.number in open_numbers:
            continue
        row.state = "closed"
        row.review_status = "CLOSED"
        payload = deepcopy(row.payload) if row.payload else {}
        payload.pop("syncStaleAt", None)
        payload["state"] = "closed"
        row.payload = payload
        closed += 1
    if closed:
        session.flush()
    return closed


def _failure_result(**extra: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "ok": False,
        "synced": 0,
        "created": 0,
        "updated": 0,
        "closed": 0,
        "softMarked": 0,
    }
    base.update(extra)
    return base


def _success_result(**extra: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "ok": True,
        "synced": 0,
        "created": 0,
        "updated": 0,
        "closed": 0,
        "softMarked": 0,
    }
    base.update(extra)
    return base


async def _client_disconnected(request: Request | None) -> bool:
    return request is not None and await request.is_disconnected()


async def _persist_pr_with_token(
    session: Session,
    *,
    gh_repo: dict[str, Any],
    gh_pr: dict[str, Any],
    owner: str,
    name: str,
    token: str,
    owner_user_id: str | None = None,
    request: Request | None = None,
) -> tuple[str, bool]:
    pr_id = f"pr-{gh_pr['id']}"
    existing_row = session.get(PullRequest, pr_id)
    created = existing_row is None
    head_sha, base_sha = extract_shas_from_github_pr(gh_pr)
    full_name = gh_repo.get("full_name") or f"{owner}/{name}"
    repo_id = existing_row.repository_id if existing_row else f"repo-{gh_repo['id']}"

    if (
        existing_row is not None
        and head_sha
        and existing_row.head_sha == head_sha
    ):
        if await _client_disconnected(request):
            return pr_id, False
        _, pr_payload = _map_pr(gh_pr, repo_id, full_name)
        pr_payload.pop("syncStaleAt", None)
        pr_repo.upsert_pull_request(
            session,
            pr_id=pr_id,
            repository_id=repo_id,
            number=gh_pr["number"],
            github_id=str(gh_pr["id"]),
            state=gh_pr.get("state", "open"),
            risk_score=pr_payload["riskScore"],
            payload=pr_payload,
            owner_user_id=owner_user_id,
            head_sha=head_sha,
            base_sha=base_sha,
        )
        session.commit()
        return pr_id, False

    if await _client_disconnected(request):
        return pr_id, created

    patch = await fetch_pull_request_diff(owner, name, gh_pr["number"], token)

    if await _client_disconnected(request):
        return pr_id, created

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
    row = session.get(PullRequest, pr_id)
    if row and row.payload:
        payload = deepcopy(row.payload)
        if payload.pop("syncStaleAt", None) is not None:
            row.payload = payload
            session.flush()
    return pr_id, created


async def sync_repository_pull_requests_unified(
    session: Session,
    repo_row: Repository,
    *,
    token: str,
    actor: str = "system",
    enqueue_analysis: bool = True,
    request: Request | None = None,
    force_reconcile: bool = False,
) -> dict[str, Any]:
    async with _lock_for(repo_row.id):
        owner, name = _resolve_owner_name(repo_row)
        if not owner or not name:
            return _failure_result(error="invalid_repo_coordinates")

        if await _client_disconnected(request):
            return _failure_result(error="client_disconnected")

        try:
            gh_prs = await fetch_repo_pull_requests(owner, name, token, state="open")
        except Exception:
            logger.exception(
                "GitHub fetch failed for %s",
                repo_row.full_name,
            )
            return _failure_result(error="github_fetch_failed")

        if not isinstance(gh_prs, list):
            return _failure_result(error="github_fetch_invalid_response")

        if await _client_disconnected(request):
            return _failure_result(error="client_disconnected")

        gh_repo = {
            "id": int(repo_row.github_id) if repo_row.github_id else 0,
            "full_name": repo_row.full_name,
            "default_branch": repo_row.default_branch or "main",
        }

        synced = 0
        created = 0
        updated = 0
        new_pr_ids: list[str] = []
        open_numbers: set[int] = set()
        fetch_completed = True

        for gh_pr in gh_prs:
            if await _client_disconnected(request):
                fetch_completed = False
                break
            open_numbers.add(int(gh_pr["number"]))
            pr_id, was_created = await _persist_pr_with_token(
                session,
                gh_repo=gh_repo,
                gh_pr=gh_pr,
                owner=owner,
                name=name,
                token=token,
                owner_user_id=repo_row.owner_user_id,
                request=request,
            )
            synced += 1
            if was_created:
                created += 1
                new_pr_ids.append(pr_id)
            else:
                updated += 1

        if not fetch_completed:
            return _failure_result(error="client_disconnected")

        closed = 0
        soft_marked = 0
        reconcile_mode = "none"

        if synced == 0:
            repo_row.last_synced_at = _now_utc()
            session.flush()
            session.commit()
            logger.info(
                "Synced PRs for %s: empty GitHub open list (no reconcile)",
                repo_row.full_name,
            )
            return _success_result(reconcileMode="none")

        if _should_hard_reconcile(repo_row, force_reconcile=force_reconcile):
            closed = reconcile_closed_pull_requests(session, repo_row.id, open_numbers)
            reconcile_mode = "hard"
        else:
            soft_marked = reconcile_soft_pull_requests(session, repo_row.id, open_numbers)
            reconcile_mode = "soft"

        repo_row.last_synced_at = _now_utc()
        session.flush()
        session.commit()

        record_activity(
            session,
            event_type="prs_synced",
            actor=actor,
            action=(
                f"Synced {synced} pull requests for {repo_row.full_name}"
                f" (reconcile={reconcile_mode}, closed={closed}, soft={soft_marked})"
            ),
            repo=repo_row.full_name,
        )
        session.commit()

        if enqueue_analysis and new_pr_ids and not await _client_disconnected(request):
            from app.services.analysis_orchestrator import enqueue_analysis_for_pr_ids

            enqueue_analysis_for_pr_ids(new_pr_ids)

        logger.info(
            "Synced PRs for %s: synced=%s created=%s updated=%s closed=%s soft=%s mode=%s",
            repo_row.full_name,
            synced,
            created,
            updated,
            closed,
            soft_marked,
            reconcile_mode,
        )
        return _success_result(
            synced=synced,
            created=created,
            updated=updated,
            closed=closed,
            softMarked=soft_marked,
            reconcileMode=reconcile_mode,
            prIds=new_pr_ids,
        )


async def sync_repository_pull_requests(
    session: Session,
    repo_row: Repository,
    *,
    token: str,
    actor: str = "system",
    enqueue_analysis: bool = True,
    request: Request | None = None,
    force_reconcile: bool = False,
) -> dict[str, Any]:
    return await sync_repository_pull_requests_unified(
        session,
        repo_row,
        token=token,
        actor=actor,
        enqueue_analysis=enqueue_analysis,
        request=request,
        force_reconcile=force_reconcile,
    )


async def sync_repository_pull_requests_for_user(
    session: Session,
    repo_row: Repository,
    user: AuthUser,
    *,
    request: Request | None = None,
    force_reconcile: bool = False,
) -> dict[str, Any]:
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
        request=request,
        force_reconcile=force_reconcile,
    )


async def sync_managed_repo_pull_requests_unified(
    session: Session,
    user: AuthUser,
    *,
    repo_ids: list[str] | None = None,
    request: Request | None = None,
    force_reconcile: bool = False,
) -> dict[str, Any]:
    token = auth_users_repo.decrypt_token(user.access_token_encrypted)
    if not token:
        from app.core.errors import api_error

        raise api_error("GitHub token missing; sign in again", 401)

    team_ids = auth_users_repo.get_team_ids_for_user(session, user.id)
    repo_payloads = repos_repo.list_repos(
        session,
        user_id=user.id,
        team_ids=team_ids,
        repo_type="all",
    )
    managed_ids = {
        item["id"]
        for item in repo_payloads
        if item.get("isManaged") is True
        or item.get("managed") is True
        or item.get("repositoryType") == "managed"
    }
    if repo_ids:
        wanted = set(repo_ids)
        managed_ids = managed_ids & wanted

    totals = _success_result(repos=0)
    if not managed_ids:
        return totals

    for repo_id in sorted(managed_ids):
        row = session.get(Repository, repo_id)
        if row is None:
            continue
        if not repository_is_managed(
            managed=bool(row.managed),
            repository_type=row.repository_type,
        ):
            continue
        result = await sync_repository_pull_requests_unified(
            session,
            row,
            token=token,
            actor=user.username,
            enqueue_analysis=True,
            request=request,
            force_reconcile=force_reconcile,
        )
        totals["repos"] = int(totals.get("repos", 0)) + 1
        if not result.get("ok", False):
            totals["ok"] = False
            continue
        for key in ("synced", "created", "updated", "closed", "softMarked"):
            totals[key] = int(totals.get(key, 0)) + int(result.get(key, 0))

    return totals


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

        pr_id, _, _ = await sync_single_pull_request(
            session, owner, name, int(number), installation_id=installation_id
        )
        return pr_id

    return await sync_single_pull_request_public_wrapper(session, owner, name, int(number))


async def sync_single_pull_request_public_wrapper(
    session: Session,
    owner: str,
    repo: str,
    number: int,
) -> str:
    from app.github.sync import sync_single_pull_request_public

    pr_id, _, _ = await sync_single_pull_request_public(session, owner, repo, number)
    return pr_id
