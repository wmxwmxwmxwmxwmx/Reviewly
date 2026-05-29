"""Sync repository metadata from GitHub (no clone, no PR diffs)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.db.models import Repository
from app.github import public_client
from app.github.client import GitHubClient
from app.repositories import repos as repos_repo
from app.services.repo_health import compute_repo_health


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _split_full_name(full_name: str) -> tuple[str, str]:
    if "/" in full_name:
        owner, name = full_name.split("/", 1)
        return owner, name
    return "", full_name


def _build_payload(
    *,
    repo_id: str,
    full_name: str,
    default_branch: str,
    open_pr_count: int,
    health_score: int,
    last_sync_time: str,
    installation_id: str | None = None,
) -> dict[str, Any]:
    owner, name = _split_full_name(full_name)
    return {
        "id": repo_id,
        "fullName": full_name,
        "name": name,
        "owner": owner,
        "defaultBranch": default_branch,
        "openPrCount": open_pr_count,
        "healthScore": health_score,
        "lastSyncTime": last_sync_time,
        "aiReviewEnabled": True,
        "installationId": installation_id,
    }


async def _upsert_from_github_repo(
    session: Session,
    gh_repo: dict[str, Any],
    *,
    installation_id: str | None,
    open_pr_count: int,
) -> None:
    full_name = gh_repo.get("full_name") or ""
    if not full_name:
        return
    repo_id = f"repo-{gh_repo['id']}"
    last_sync = _now_iso()
    health = compute_repo_health(session, repo_id, open_pr_count)
    payload = _build_payload(
        repo_id=repo_id,
        full_name=full_name,
        default_branch=gh_repo.get("default_branch", "main"),
        open_pr_count=open_pr_count,
        health_score=health,
        last_sync_time=last_sync,
        installation_id=installation_id,
    )
    repos_repo.upsert_repo(
        session,
        repo_id=repo_id,
        full_name=full_name,
        installation_id=installation_id,
        payload=payload,
    )


async def _sync_installation_metadata(session: Session, installation_id: str) -> int:
    client = GitHubClient(installation_id)
    gh_repos = await client.list_repos()
    count = 0
    for gh_repo in gh_repos:
        full_name = gh_repo["full_name"]
        owner, name = full_name.split("/", 1)
        try:
            prs = await client.list_pull_requests(owner, name)
            open_count = len(prs)
        except Exception:
            open_count = 0
        await _upsert_from_github_repo(
            session,
            gh_repo,
            installation_id=installation_id,
            open_pr_count=open_count,
        )
        count += 1
    return count


async def _sync_pat_metadata(session: Session) -> int:
    gh_repos = await public_client.list_user_repos()
    count = 0
    for gh_repo in gh_repos:
        owner = gh_repo.get("owner", {}).get("login", "")
        name = gh_repo.get("name", "")
        if not owner or not name:
            continue
        try:
            prs = await public_client.list_open_pull_requests(owner, name)
            open_count = len(prs)
        except Exception:
            open_count = 0
        await _upsert_from_github_repo(
            session,
            gh_repo,
            installation_id=None,
            open_pr_count=open_count,
        )
        count += 1
    return count


async def sync_repositories_metadata(session: Session) -> dict[str, Any]:
    total = 0

    if settings.github_app_id and settings.github_app_private_key:
        rows = session.scalars(
            select(Repository.installation_id)
            .where(Repository.installation_id.isnot(None))
            .distinct()
        ).all()
        installation_ids = [i for i in rows if i]
        if not installation_ids:
            if settings.github_pat.strip():
                total = await _sync_pat_metadata(session)
                session.commit()
                return {"syncedRepos": total, "status": "ok"}
            raise api_error(
                "请先安装 GitHub App 或配置 GITHUB_PAT，以同步仓库列表。",
                501,
            )
        for inst_id in installation_ids:
            total += await _sync_installation_metadata(session, inst_id)
        session.commit()
        return {"syncedRepos": total, "status": "ok"}

    if settings.github_pat.strip():
        total = await _sync_pat_metadata(session)
        session.commit()
        return {"syncedRepos": total, "status": "ok"}

    raise api_error(
        "请配置 GitHub App 或 GITHUB_PAT 以同步仓库。",
        501,
    )
