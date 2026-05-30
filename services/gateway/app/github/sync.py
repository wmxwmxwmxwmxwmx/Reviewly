"""Sync GitHub installation data into DB (B3)."""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Repository
from app.github import public_client
from app.integrations.github.github_client import GitHubClient
from app.grpc_client.engine import get_engine_client
from app.repositories import pull_request_files as pr_files_repo
from app.repositories import pull_requests as pr_repo
from app.repositories import repos as repos_repo
from app.repositories.seed_filter import SOURCE_TYPE_EXTERNAL, SOURCE_TYPE_GITHUB


def _risk_level(score: int) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _deploy_risk_level(score: int) -> str:
    """Map score to deploy/rollback risk (high | medium | low only)."""
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _enrich_pr_payload(payload: dict[str, Any], risk_score: int) -> dict[str, Any]:
    deploy = _deploy_risk_level(risk_score)
    additions = int(payload.get("additions", 0))
    payload.setdefault("securityScore", max(0, 100 - risk_score))
    payload.setdefault("performanceScore", max(40, 100 - min(additions // 100, 50)))
    payload.setdefault("maintainabilityScore", 70)
    payload.setdefault("deploymentRisk", deploy)
    payload.setdefault("rollbackComplexity", deploy)
    return payload


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
    _enrich_pr_payload(payload, risk_score)
    return pr_id, payload


async def _fetch_pr_files_and_commits(
    owner: str,
    name: str,
    number: int,
    *,
    installation_id: str | None,
) -> tuple[list[dict[str, Any]], int]:
    if installation_id:
        client = GitHubClient(installation_id)
        gh_files = await client.list_pull_files(owner, name, number)
        commits = await client.list_pull_commits(owner, name, number)
    else:
        gh_files = await public_client.list_pull_files(owner, name, number)
        commits = await public_client.list_pull_commits(owner, name, number)
    return gh_files, len(commits)


async def _persist_pull_request(
    session: Session,
    *,
    gh_pr: dict[str, Any],
    gh_repo: dict[str, Any],
    owner: str,
    name: str,
    installation_id: str | None,
    patch: str,
    gh_files: list[dict[str, Any]] | None = None,
    commit_count: int | None = None,
    owner_user_id: str | None = None,
    repo_source_type: str | None = None,
) -> str:
    engine = get_engine_client()
    full_name = gh_repo.get("full_name") or f"{owner}/{name}"
    repo_id = f"repo-{gh_repo['id']}"
    if repo_source_type is None:
        repo_source_type = SOURCE_TYPE_GITHUB if installation_id else SOURCE_TYPE_EXTERNAL
    repo_payload = {
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
        payload=repo_payload,
        source_type=repo_source_type,
        owner_user_id=owner_user_id,
    )
    pr_id, pr_payload = _map_pr(gh_pr, repo_id, name)
    if commit_count is not None:
        pr_payload["commits"] = commit_count
    if gh_files is None:
        gh_files, commits_n = await _fetch_pr_files_and_commits(
            owner, name, gh_pr["number"], installation_id=installation_id
        )
        pr_payload["commits"] = commits_n
    mapped_files = [pr_files_repo.map_github_file(f) for f in gh_files]
    pr_files_repo.replace_files(session, pr_id, mapped_files)
    diff_files = pr_files_repo.to_diff_view_rows(mapped_files)
    if not diff_files:
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
    session.commit()
    return pr_id


async def sync_single_pull_request(
    session: Session,
    owner: str,
    repo: str,
    number: int,
    *,
    installation_id: str,
    owner_user_id: str | None = None,
) -> str:
    client = GitHubClient(installation_id)
    gh_pr = await client.get_pull_request(owner, repo, number)
    patch = await client.get_pull_diff_patch(owner, repo, number)
    gh_files, commit_count = await _fetch_pr_files_and_commits(
        owner, repo, number, installation_id=installation_id
    )
    gh_repos = await client.list_repos()
    gh_repo = next((r for r in gh_repos if r.get("full_name") == f"{owner}/{repo}"), None)
    if gh_repo is None:
        gh_repo = {
            "id": gh_pr.get("base", {}).get("repo", {}).get("id") or 0,
            "full_name": f"{owner}/{repo}",
            "default_branch": gh_pr.get("base", {}).get("ref", "main"),
        }
    return await _persist_pull_request(
        session,
        gh_pr=gh_pr,
        gh_repo=gh_repo,
        owner=owner,
        name=repo,
        installation_id=installation_id,
        patch=patch,
        gh_files=gh_files,
        commit_count=commit_count,
        owner_user_id=owner_user_id,
        repo_source_type=SOURCE_TYPE_GITHUB,
    )


async def sync_single_pull_request_public(
    session: Session,
    owner: str,
    repo: str,
    number: int,
    *,
    owner_user_id: str | None = None,
) -> str:
    gh_pr = await public_client.get_pull_request(owner, repo, number)
    try:
        gh_repo = await public_client.get_repo_public(owner, repo)
    except HTTPException:
        base_repo = gh_pr.get("base", {}).get("repo", {}) or {}
        gh_repo = {
            "id": base_repo.get("id") or 0,
            "full_name": base_repo.get("full_name") or f"{owner}/{repo}",
            "default_branch": base_repo.get("default_branch", "main"),
        }
    patch = await public_client.get_pull_diff_patch(owner, repo, number)
    gh_files, commit_count = await _fetch_pr_files_and_commits(
        owner, repo, number, installation_id=None
    )
    return await _persist_pull_request(
        session,
        gh_pr=gh_pr,
        gh_repo=gh_repo,
        owner=owner,
        name=repo,
        installation_id=None,
        patch=patch,
        gh_files=gh_files,
        commit_count=commit_count,
        owner_user_id=owner_user_id,
        repo_source_type=SOURCE_TYPE_EXTERNAL,
    )


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
            source_type=SOURCE_TYPE_GITHUB,
        )
        synced_repos += 1

        prs = await client.list_pull_requests(owner, name)
        payload["openPrCount"] = len(prs)

        for gh_pr in prs:
            pr_id, pr_payload = _map_pr(gh_pr, repo_id, name)
            patch = await client.get_pull_diff_patch(owner, name, gh_pr["number"])
            gh_files, commit_count = await _fetch_pr_files_and_commits(
                owner, name, gh_pr["number"], installation_id=installation_id
            )
            pr_payload["commits"] = commit_count
            mapped_files = [pr_files_repo.map_github_file(f) for f in gh_files]
            pr_files_repo.replace_files(session, pr_id, mapped_files)
            diff_files = pr_files_repo.to_diff_view_rows(mapped_files)
            if not diff_files:
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
