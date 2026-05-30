"""Refresh pull request commit SHAs from GitHub for analysis cache versioning."""
from __future__ import annotations

import logging
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AuthUser, PullRequest, Repository
from app.github import public_client
from app.github.github_errors import raise_for_github_response
from app.github.repo_context import resolve_access_token
from app.integrations.github.github_client import GitHubClient
from app.services.analysis_cache import (
    extract_shas_from_github_pr,
    sync_pr_analysis_version,
)

logger = logging.getLogger(__name__)

_API_VERSION = "2022-11-28"


def pr_has_head_sha(session: Session, pr_id: str) -> bool:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return False
    if row.head_sha:
        return True
    payload = row.payload if isinstance(row.payload, dict) else None
    if payload:
        return bool(payload.get("headSha") or payload.get("head_sha"))
    return False


def _parse_owner_repo(full_name: str) -> tuple[str, str] | None:
    if "/" not in full_name:
        return None
    owner, name = full_name.split("/", 1)
    if owner and name:
        return owner, name
    return None


def _resolve_full_name(row: PullRequest, repo: Repository | None) -> str | None:
    if row.payload and isinstance(row.payload, dict):
        name = row.payload.get("repo") or row.payload.get("fullName")
        if isinstance(name, str) and name.strip():
            return name.strip()
    if repo and repo.full_name:
        return repo.full_name
    return None


def _auth_headers(token: str | None) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": _API_VERSION,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _fetch_github_pr(
    owner: str,
    repo: str,
    number: int,
    *,
    installation_id: str | None,
    token: str | None,
) -> dict[str, Any] | None:
    try:
        if installation_id and settings.github_app_id and settings.github_app_private_key:
            client = GitHubClient(installation_id)
            return await client.get_pull_request(owner, repo, number)
        if token:
            url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
            async with httpx.AsyncClient(timeout=60.0) as http:
                resp = await http.get(url, headers=_auth_headers(token))
                if resp.status_code >= 400:
                    raise_for_github_response(
                        resp,
                        resource="该 PR",
                        has_pat=bool(token or settings.github_pat.strip()),
                    )
                return resp.json()
        return await public_client.get_pull_request(owner, repo, number)
    except Exception:
        logger.exception(
            "Failed to fetch GitHub PR metadata for %s/%s#%s",
            owner,
            repo,
            number,
        )
        return None


async def refresh_pr_shas_from_github(
    session: Session,
    pr_id: str,
    *,
    user: AuthUser | None = None,
) -> bool:
    """Fetch head/base SHA from GitHub and persist on the PR row. Returns True on success."""
    row = session.get(PullRequest, pr_id)
    if row is None:
        return False

    repo = session.get(Repository, row.repository_id)
    full_name = _resolve_full_name(row, repo)
    if not full_name:
        return False

    parsed = _parse_owner_repo(full_name)
    if not parsed:
        return False
    owner, name = parsed

    auth_user = user
    if auth_user is None and row.owner_user_id:
        auth_user = session.get(AuthUser, row.owner_user_id)

    token: str | None = None
    installation_id = repo.installation_id if repo else None
    if repo:
        token = await resolve_access_token(session, repo, auth_user)

    gh_pr = await _fetch_github_pr(
        owner,
        name,
        row.number,
        installation_id=installation_id,
        token=token,
    )
    if not gh_pr:
        return False

    head_sha, base_sha = extract_shas_from_github_pr(gh_pr)
    if not head_sha:
        return False

    sync_pr_analysis_version(
        session,
        row,
        head_sha=head_sha,
        base_sha=base_sha,
        full_name=full_name,
    )
    session.commit()
    return True
