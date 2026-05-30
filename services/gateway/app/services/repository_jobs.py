"""Repository background job runner and scheduler."""
from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.db import session as db_session
from app.repositories import repository_jobs as rjob_repo
from app.services import repo_scan
from app.services.architecture_scan import run_scan
from app.services.repository_onboarding import run_onboarding

logger = logging.getLogger(__name__)


def _run_job_sync(job_id: str) -> None:
    session = db_session.SessionLocal()
    try:
        asyncio.run(_execute_job(session, job_id))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Repository job %s failed: %s", job_id, exc)
        try:
            rjob_repo.update_job(
                session,
                job_id,
                status=rjob_repo.JOB_STATUS_FAILED,
                message=str(exc),
            )
            session.commit()
        except Exception:  # noqa: BLE001
            session.rollback()
    finally:
        session.close()


def schedule_repository_job(job_id: str) -> None:
    threading.Thread(target=_run_job_sync, args=(job_id,), daemon=True).start()


def _progress_updater(session: Session, job_id: str) -> Callable[[int, str], None]:
    def _cb(progress: int, message: str) -> None:
        if rjob_repo.is_job_cancelled(session, job_id):
            raise RuntimeError("任务已取消")
        rjob_repo.update_job(
            session,
            job_id,
            status=rjob_repo.JOB_STATUS_RUNNING,
            progress=progress,
            message=message,
        )
        session.commit()

    return _cb


async def _execute_job(session: Session, job_id: str) -> None:
    row = rjob_repo.get_job_row(session, job_id)
    if row is None:
        return
    if row.status == rjob_repo.JOB_STATUS_CANCELLED:
        return

    rjob_repo.update_job(
        session,
        job_id,
        status=rjob_repo.JOB_STATUS_RUNNING,
        progress=1,
        message="任务启动…",
    )
    session.commit()

    repo_id = row.repository_id
    job_type = row.job_type

    try:
        if job_type == "onboarding":
            await run_onboarding(session, job_id)
        elif job_type == "clone":
            from app.services.repo_clone import ensure_repo_clone

            cb = _progress_updater(session, job_id)
            cb(20, "正在克隆仓库…")
            await ensure_repo_clone(session, repo_id, force_refresh=False)
            cb(100, "克隆完成")
            rjob_repo.update_job(
                session,
                job_id,
                status=rjob_repo.JOB_STATUS_SUCCESS,
                progress=100,
                message="克隆完成",
            )
        elif job_type == "architecture":
            cb = _progress_updater(session, job_id)
            cb(15, "正在扫描架构依赖…")

            async def arch_progress(phase: str, pct: int, msg: str) -> None:
                cb(pct, msg)

            await run_scan(session, repo_id)
            rjob_repo.update_job(
                session,
                job_id,
                status=rjob_repo.JOB_STATUS_SUCCESS,
                progress=100,
                message="架构扫描完成",
            )
        elif job_type == "security":
            cb = _progress_updater(session, job_id)
            count = await repo_scan.run_security_scan(
                session,
                repo_id,
                repository_job_id=job_id,
                progress_cb=cb,
            )
            rjob_repo.update_job(
                session,
                job_id,
                status=rjob_repo.JOB_STATUS_SUCCESS,
                progress=100,
                message=f"安全扫描完成，发现 {count} 项",
            )
        elif job_type == "performance":
            cb = _progress_updater(session, job_id)
            count = await repo_scan.run_performance_scan(
                session,
                repo_id,
                repository_job_id=job_id,
                progress_cb=cb,
            )
            rjob_repo.update_job(
                session,
                job_id,
                status=rjob_repo.JOB_STATUS_SUCCESS,
                progress=100,
                message=f"性能扫描完成，发现 {count} 项",
            )
        elif job_type == "repo_ai":
            cb = _progress_updater(session, job_id)
            cb(20, "正在收集仓库上下文…")
            from app.services.repo_ai_summary import generate_repo_ai_summary

            await generate_repo_ai_summary(session, repo_id)
            rjob_repo.update_job(
                session,
                job_id,
                status=rjob_repo.JOB_STATUS_SUCCESS,
                progress=100,
                message="AI 仓库分析完成",
            )
        elif job_type == "sync_prs":
            cb = _progress_updater(session, job_id)
            cb(10, "正在同步 PR…")
            from app.repositories import repos as repos_repo
            from app.services.analysis_orchestrator import enqueue_analysis_for_pr_ids
            from app.services.pr_sync import sync_repository_pull_requests_for_user

            repo_row = repos_repo.get_repo_row(session, repo_id)
            if repo_row is None:
                raise RuntimeError("仓库不存在")
            from app.repositories import auth_users as auth_users_repo

            user = None
            if repo_row.owner_user_id:
                user = auth_users_repo.get_user_row(session, repo_row.owner_user_id)
            if user is None:
                user = auth_users_repo.get_or_create_bypass_user(session)
            result = await sync_repository_pull_requests_for_user(session, repo_row, user)
            pr_ids = result.get("prIds") or []
            if pr_ids:
                enqueue_analysis_for_pr_ids(pr_ids, max_concurrent=3)
            cb(100, f"已同步 {result.get('synced', 0)} 个 PR")
            rjob_repo.update_job(
                session,
                job_id,
                status=rjob_repo.JOB_STATUS_SUCCESS,
                progress=100,
                message=f"PR 同步完成（{result.get('synced', 0)}）",
            )
        else:
            raise RuntimeError(f"未知任务类型: {job_type}")
        session.commit()
    except RuntimeError as exc:
        if "任务已取消" in str(exc):
            session.commit()
            return
        rjob_repo.update_job(
            session,
            job_id,
            status=rjob_repo.JOB_STATUS_FAILED,
            message=str(exc),
        )
        session.commit()
        raise


def create_and_schedule(
    session: Session,
    *,
    repository_id: str,
    job_type: str,
    parent_job_id: str | None = None,
    message: str | None = None,
) -> str:
    row = rjob_repo.create_job(
        session,
        repository_id=repository_id,
        job_type=job_type,
        parent_job_id=parent_job_id,
        message=message,
    )
    session.commit()
    schedule_repository_job(row.id)
    return row.id
