"""Sync GitHub installation data into DB (B3)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Repository
from app.github.client import GitHubClient
from app.grpc_client.engine import get_engine_client
from app.repositories import pull_requests as pr_repo
from app.repositories import repos as repos_repo


def _risk_level(score: int) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _map_pr(gh_pr: dict[str, Any], repo_id: str, repo_label: str) -> tuple[str, dict[str, Any]]:
    pr_id = f"pr-{gh_pr['id']}"
    risk_score = min(gh_pr.get("additions", 0) // 50, 100)
    payload = {
        "id": pr_id,
        "repoId": repo_id,
        "repo": repo_label,
        "number": gh_pr["number"],
        "title": gh_pr.get("title", ""),
        "author": gh_pr.get("user", {}).get("login", "unknown"),
        "state": gh_pr.get("state", "open"),
        "riskLevel": _risk_level(risk_score),
        "riskScore": risk_score,
        "updatedAt": gh_pr.get("updated_at", ""),
        "sourceBranch": gh_pr.get("head", {}).get("ref", ""),
        "targetBranch": gh_pr.get("base", {}).get("ref", "main"),
        "authorAvatar": (gh_pr.get("user", {}).get("login", "?")[:2]).upper(),
        "createdAt": gh_pr.get("created_at", ""),
        "labels": [],
        "filesChanged": gh_pr.get("changed_files", 0),
        "additions": gh_pr.get("additions", 0),
        "deletions": gh_pr.get("deletions", 0),
        "commits": 0,
        "url": gh_pr.get("html_url", ""),
    }
    return pr_id, payload


async def sync_installation(session: Session, installation_id: str) -> dict[str, int]:
    client = GitHubClient(installation_id)
    gh_repos = await client.list_repos()
    engine = get_engine_client()
    synced_repos = 0
    synced_prs = 0

    for gh_repo in gh_repos:
        full_name = gh_repo["full_name"]
        owner, name = full_name.split("/", 1)
        repo_id = f"repo-{gh_repo['id']}"
        payload = {
            "id": repo_id,
            "fullName": full_name,
            "defaultBranch": gh_repo.get("default_branch", "main"),
            "openPrCount": 0,
            "healthScore": 80,
            "aiReviewEnabled": True,
        }
        repos_repo.upsert_repo(
            session,
            repo_id=repo_id,
            full_name=full_name,
            installation_id=installation_id,
            payload=payload,
        )
        synced_repos += 1

        prs = await client.list_pull_requests(owner, name)
        payload["openPrCount"] = len(prs)

        for gh_pr in prs:
            pr_id, pr_payload = _map_pr(gh_pr, repo_id, name)
            patch = await client.get_pull_diff_patch(owner, name, gh_pr["number"])
            diff_files = await engine.parse_diff(patch)
            pr_repo.upsert_pull_request(
                session,
                pr_id=pr_id,
                repository_id=repo_id,
                number=gh_pr["number"],
                github_id=str(gh_pr["id"]),
                state=gh_pr.get("state", "open"),
                risk_score=pr_payload["riskScore"],
                payload=pr_payload,
                diff_files=diff_files,
                patch=patch,
            )
            synced_prs += 1

    session.commit()
    return {"syncedRepos": synced_repos, "syncedPrs": synced_prs}


async def sync_all_installations(session: Session) -> dict[str, int]:
    rows = session.scalars(
        select(Repository.installation_id).where(Repository.installation_id.isnot(None)).distinct()
    ).all()
    installation_ids = [i for i in rows if i]
    if not installation_ids:
        return {"syncedRepos": 0, "syncedPrs": 0, "status": "no_installations"}

    total_repos = 0
    total_prs = 0
    for inst_id in installation_ids:
        result = await sync_installation(session, inst_id)
        total_repos += result["syncedRepos"]
        total_prs += result["syncedPrs"]

    return {"syncedRepos": total_repos, "syncedPrs": total_prs, "status": "ok"}


def record_installation(session: Session, installation_id: str, account_login: str) -> None:
    repo_id = f"inst-{installation_id}"
    repos_repo.upsert_repo(
        session,
        repo_id=repo_id,
        full_name=account_login,
        installation_id=installation_id,
        payload={
            "id": repo_id,
            "fullName": account_login,
            "defaultBranch": "main",
            "openPrCount": 0,
            "healthScore": 80,
            "aiReviewEnabled": True,
        },
    )
    session.commit()
