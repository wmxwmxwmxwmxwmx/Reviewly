"""Repository-level background job persistence."""
from __future__ import annotations

import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import RepositoryJob

JOB_STATUS_PENDING = "pending"
JOB_STATUS_RUNNING = "running"
JOB_STATUS_SUCCESS = "success"
JOB_STATUS_FAILED = "failed"
JOB_STATUS_CANCELLED = "cancelled"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _dt_to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")


def _job_to_api(row: RepositoryJob) -> dict[str, Any]:
    return {
        "id": row.id,
        "repositoryId": row.repository_id,
        "jobType": row.job_type,
        "status": row.status,
        "progress": row.progress,
        "message": row.message,
        "parentJobId": row.parent_job_id,
        "payload": deepcopy(row.payload) if row.payload else None,
        "createdAt": _dt_to_iso(row.created_at) or "",
        "updatedAt": _dt_to_iso(row.updated_at) or "",
        "finishedAt": _dt_to_iso(row.finished_at),
    }


def create_job(
    session: Session,
    *,
    repository_id: str,
    job_type: str,
    parent_job_id: str | None = None,
    message: str | None = None,
) -> RepositoryJob:
    row = RepositoryJob(
        id=f"rjob-{uuid.uuid4().hex[:12]}",
        repository_id=repository_id,
        job_type=job_type,
        status=JOB_STATUS_PENDING,
        progress=0,
        message=message,
        parent_job_id=parent_job_id,
    )
    session.add(row)
    session.flush()
    return row


def get_job_row(session: Session, job_id: str) -> RepositoryJob | None:
    return session.get(RepositoryJob, job_id)


def get_job(session: Session, job_id: str) -> dict[str, Any] | None:
    row = get_job_row(session, job_id)
    if row is None:
        return None
    return _job_to_api(row)


def update_job(
    session: Session,
    job_id: str,
    *,
    status: str | None = None,
    progress: int | None = None,
    message: str | None = None,
    payload: dict[str, Any] | None = None,
) -> RepositoryJob | None:
    row = get_job_row(session, job_id)
    if row is None:
        return None
    if status is not None:
        row.status = status
        if status in (JOB_STATUS_SUCCESS, JOB_STATUS_FAILED, JOB_STATUS_CANCELLED):
            row.finished_at = _now_utc()
    if progress is not None:
        row.progress = max(0, min(100, progress))
    if message is not None:
        row.message = message
    if payload is not None:
        row.payload = payload
    row.updated_at = _now_utc()
    session.flush()
    return row


def cancel_job(session: Session, job_id: str) -> bool:
    row = get_job_row(session, job_id)
    if row is None:
        return False
    if row.status in (JOB_STATUS_SUCCESS, JOB_STATUS_FAILED, JOB_STATUS_CANCELLED):
        return False
    row.status = JOB_STATUS_CANCELLED
    row.message = row.message or "已取消"
    row.finished_at = _now_utc()
    row.updated_at = _now_utc()
    session.flush()
    return True


def is_job_cancelled(session: Session, job_id: str) -> bool:
    row = get_job_row(session, job_id)
    return row is not None and row.status == JOB_STATUS_CANCELLED


def list_jobs_for_repo(
    session: Session,
    repository_id: str,
    *,
    limit: int = 20,
) -> list[dict[str, Any]]:
    rows = session.scalars(
        select(RepositoryJob)
        .where(RepositoryJob.repository_id == repository_id)
        .order_by(RepositoryJob.created_at.desc())
        .limit(limit)
    ).all()
    return [_job_to_api(r) for r in rows]


def get_active_job_for_repo(session: Session, repository_id: str) -> dict[str, Any] | None:
    row = session.scalar(
        select(RepositoryJob)
        .where(
            RepositoryJob.repository_id == repository_id,
            RepositoryJob.status.in_((JOB_STATUS_PENDING, JOB_STATUS_RUNNING)),
        )
        .order_by(RepositoryJob.created_at.desc())
        .limit(1)
    )
    if row is None:
        return None
    return _job_to_api(row)
