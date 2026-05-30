"""Import a single pull request by GitHub URL into the database."""
from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.db.models import PullRequest
from app.github import sync
from app.integrations.github.app_auth import get_installation_id_for_repo
from app.github.url_parser import parse_github_pr_url
from app.repositories import pull_requests as pr_repo
from app.services import analysis_orchestrator
from app.services.pr_metadata import pr_has_head_sha, refresh_pr_shas_from_github

logger = logging.getLogger(__name__)


def _import_result(
    pr_id: str,
    repo_id: str,
    source: str,
    *,
    repository_created: bool,
) -> dict[str, str | bool]:
    out: dict[str, str | bool] = {
        "prId": pr_id,
        "repoId": repo_id,
        "source": source,
        "repositoryCreated": repository_created,
    }
    try:
        analysis = analysis_orchestrator.enqueue_analysis(pr_id)
        if analysis:
            if analysis.get("jobId"):
                out["analysisJobId"] = str(analysis["jobId"])
            out["analysisQueued"] = bool(analysis.get("queued"))
            out["analysisCacheHit"] = bool(analysis.get("cacheHit"))
    except Exception:
        logger.exception("import_pull_request_by_url analysis enqueue failed prId=%s", pr_id)
    return out


def _repo_id_for_pr(session: Session, pr_id: str) -> str:
    row = session.get(PullRequest, pr_id)
    return row.repository_id if row is not None else ""


async def import_pull_request_by_url(
    session: Session,
    url: str,
    *,
    user_id: str | None = None,
) -> dict[str, str | bool]:
    try:
        parsed = parse_github_pr_url(url)

        cached = pr_repo.find_by_repo_number(session, parsed.owner, parsed.repo, parsed.number)
        if cached:
            logger.info(
                "import_pull_request_by_url cache hit prId=%s owner=%s repo=%s number=%s",
                cached,
                parsed.owner,
                parsed.repo,
                parsed.number,
            )
            if not pr_has_head_sha(session, cached):
                auth_user = None
                if user_id:
                    from app.repositories import auth_users as auth_users_repo

                    auth_user = auth_users_repo.get_user_row(session, user_id)
                await refresh_pr_shas_from_github(session, cached, user=auth_user)
            return _import_result(
                cached,
                _repo_id_for_pr(session, cached),
                "cache",
                repository_created=False,
            )

        last_error: HTTPException | None = None

        if settings.github_app_id and settings.github_app_private_key:
            try:
                installation_id = await get_installation_id_for_repo(parsed.owner, parsed.repo)
            except httpx.HTTPError as exc:
                logger.exception(
                    "GitHub App installation lookup failed for %s/%s",
                    parsed.owner,
                    parsed.repo,
                )
                last_error = api_error(f"GitHub App 安装查询失败：{exc}", 502)
                installation_id = None
            if installation_id:
                try:
                    pr_id, repo_id, repository_created = await sync.sync_single_pull_request(
                        session,
                        parsed.owner,
                        parsed.repo,
                        parsed.number,
                        installation_id=installation_id,
                        owner_user_id=user_id,
                    )
                    logger.info(
                        "import_pull_request_by_url github_app ok prId=%s %s/%s#%s",
                        pr_id,
                        parsed.owner,
                        parsed.repo,
                        parsed.number,
                    )
                    return _import_result(
                        pr_id,
                        repo_id,
                        "github_app",
                        repository_created=repository_created,
                    )
                except HTTPException as exc:
                    last_error = exc
                except httpx.HTTPError as exc:
                    logger.exception(
                        "GitHub App sync failed for %s/%s#%s",
                        parsed.owner,
                        parsed.repo,
                        parsed.number,
                    )
                    last_error = api_error(f"GitHub App 同步失败：{exc}", 502)

        try:
            pr_id, repo_id, repository_created = await sync.sync_single_pull_request_public(
                session,
                parsed.owner,
                parsed.repo,
                parsed.number,
                owner_user_id=user_id,
            )
            logger.info(
                "import_pull_request_by_url github_public ok prId=%s %s/%s#%s",
                pr_id,
                parsed.owner,
                parsed.repo,
                parsed.number,
            )
            return _import_result(
                pr_id,
                repo_id,
                "github_public",
                repository_created=repository_created,
            )
        except HTTPException as exc:
            last_error = exc

        if last_error is not None:
            raise last_error

        raise api_error(
            "请配置 GitHub App 或 GITHUB_PAT 以导入 PR，或粘贴已同步到本地的 PR 链接。",
            501,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("import_pull_request_by_url failed for url=%r", url)
        raise
