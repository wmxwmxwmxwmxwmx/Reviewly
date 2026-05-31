"""Onboarding pipeline after adopting an external repository."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.repositories import repository_jobs as rjob_repo
from app.repositories import repos as repos_repo
from app.services import repo_scan
from app.services.architecture_scan import run_scan
from app.services.repo_ai_summary import generate_repo_ai_summary
from app.services.repo_clone import ensure_repo_clone

logger = logging.getLogger(__name__)


def _check_cancelled(session: Session, job_id: str) -> None:
    if rjob_repo.is_job_cancelled(session, job_id):
        raise RuntimeError("任务已取消")


def _update(session: Session, job_id: str, progress: int, message: str) -> None:
    _check_cancelled(session, job_id)
    rjob_repo.update_job(
        session,
        job_id,
        status=rjob_repo.JOB_STATUS_RUNNING,
        progress=progress,
        message=message,
    )
    session.commit()


async def run_onboarding(session: Session, job_id: str) -> None:
    row = rjob_repo.get_job_row(session, job_id)
    if row is None:
        return
    repo_id = row.repository_id
    repo_row = repos_repo.get_repo_row(session, repo_id)
    if repo_row is None:
        raise RuntimeError("仓库不存在")

    try:
        _update(session, job_id, 5, "正在刷新仓库元数据…")
        repo_url = repo_row.html_url or (
            f"https://github.com/{repo_row.full_name}" if repo_row.full_name else None
        )
        if repo_url:
            try:
                from app.repositories import auth_users as auth_users_repo
                from app.github.repositories import fetch_repo_by_url
                from app.github.repo_mapper import github_repo_to_metadata
                from datetime import datetime, timezone

                user_token: str | None = None
                if repo_row.owner_user_id:
                    owner = auth_users_repo.get_user_row(session, repo_row.owner_user_id)
                    if owner:
                        user_token = auth_users_repo.decrypt_token(owner.access_token_encrypted)
                gh = await fetch_repo_by_url(repo_url, user_token)
                metadata = github_repo_to_metadata(gh, open_prs=repo_row.open_prs or 0, last_synced_at=datetime.now(timezone.utc))
                metadata["id"] = repo_id
                metadata["owner_user_id"] = repo_row.owner_user_id
                repos_repo.upsert_repository(session, metadata)
                session.commit()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Onboarding metadata refresh skipped: %s", exc)

        _update(session, job_id, 15, "正在克隆仓库…")
        await ensure_repo_clone(session, repo_id)

        _update(session, job_id, 30, "正在扫描架构依赖…")
        await run_scan(session, repo_id)

        _update(session, job_id, 50, "正在执行安全扫描…")
        await repo_scan.run_security_scan(session, repo_id, repository_job_id=job_id)

        _update(session, job_id, 65, "正在执行性能扫描…")
        await repo_scan.run_performance_scan(session, repo_id, repository_job_id=job_id)

        _update(session, job_id, 78, "正在收集 README 与上下文…")
        await generate_repo_ai_summary(session, repo_id)

        _update(session, job_id, 88, "正在生成 AI 仓库分析…")
        # generate_repo_ai_summary already persisted analysis

        _update(session, job_id, 92, "正在同步开放 PR…")
        from app.repositories import auth_users as auth_users_repo
        from app.services.pr_sync import sync_repository_pull_requests_for_user

        sync_result = {"synced": 0, "created": 0, "updated": 0, "prIds": []}
        user = None
        if repo_row.owner_user_id:
            user = auth_users_repo.get_user_row(session, repo_row.owner_user_id)
        if user is None:
            user = auth_users_repo.get_or_create_bypass_user(session)
        try:
            sync_result = await sync_repository_pull_requests_for_user(session, repo_row, user)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Onboarding PR sync skipped: %s", exc)

        rjob_repo.update_job(
            session,
            job_id,
            status=rjob_repo.JOB_STATUS_SUCCESS,
            progress=100,
            message=f"纳管完成，已同步 {sync_result.get('synced', 0)} 个 PR",
        )
        session.commit()
    except Exception as exc:  # noqa: BLE001
        rjob_repo.update_job(
            session,
            job_id,
            status=rjob_repo.JOB_STATUS_FAILED,
            progress=row.progress,
            message=f"纳管失败: {exc}",
        )
        session.commit()
        raise
