from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest
from app.mock import seed


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _job_to_api(job: AnalysisJob) -> dict:
    return {
        "id": job.id,
        "pullRequestId": job.pull_request_id,
        "status": job.status,
        "progress": job.progress,
        "chunkIndex": job.chunk_index,
        "chunkTotal": job.chunk_total,
        "createdAt": job.created_at.isoformat().replace("+00:00", "Z") if job.created_at else _now_iso(),
        "completedAt": job.completed_at.isoformat().replace("+00:00", "Z") if job.completed_at else None,
        "error": job.error_message,
    }


def _finding_to_api(row: AnalysisFinding) -> dict:
    if row.payload:
        return deepcopy(row.payload)
    return {
        "id": row.id,
        "type": row.type,
        "severity": row.severity,
        "title": row.title,
        "file": row.file,
        "line": row.line,
    }


def create_job(session: Session, pull_request_id: str, chunk_total: int) -> AnalysisJob:
    import uuid

    job_id = f"job-{uuid.uuid4().hex[:12]}"
    job = AnalysisJob(
        id=job_id,
        pull_request_id=pull_request_id,
        status="pending",
        progress=0,
        chunk_index=0,
        chunk_total=max(chunk_total, 1),
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def get_job(session: Session, job_id: str) -> dict | None:
    job = session.get(AnalysisJob, job_id)
    return _job_to_api(job) if job else None


def update_job(session: Session, job_id: str, **fields: object) -> None:
    job = session.get(AnalysisJob, job_id)
    if not job:
        return
    for key, value in fields.items():
        if key == "status":
            job.status = str(value)
        elif key == "progress":
            job.progress = int(value)  # type: ignore[arg-type]
        elif key == "chunkIndex":
            job.chunk_index = int(value)  # type: ignore[arg-type]
        elif key == "chunkTotal":
            job.chunk_total = int(value)  # type: ignore[arg-type]
        elif key == "error":
            job.error_message = str(value) if value else None
        elif key == "completedAt":
            job.completed_at = datetime.now(timezone.utc)
        elif key == "resultSummary":
            job.result_summary = value  # type: ignore[assignment]
    session.commit()


def save_findings(session: Session, job_id: str, findings: list[dict]) -> None:
    for f in findings:
        session.add(
            AnalysisFinding(
                id=f.get("id", f"finding-{job_id}-{f.get('file', 'x')}"),
                job_id=job_id,
                type=f.get("type", "security"),
                severity=f.get("severity", "medium"),
                title=f.get("title", ""),
                file=f.get("file", ""),
                line=int(f.get("line", 0)),
                payload=deepcopy(f),
            )
        )
    session.commit()


def get_latest_analysis(session: Session, pull_request_id: str) -> dict | None:
    job = session.scalar(
        select(AnalysisJob)
        .where(
            AnalysisJob.pull_request_id == pull_request_id,
            AnalysisJob.status == "completed",
        )
        .order_by(AnalysisJob.completed_at.desc())
        .limit(1)
    )
    if job and job.result_summary:
        return deepcopy(job.result_summary)

    pr = session.get(PullRequest, pull_request_id)
    if pr is None:
        return None
    return seed.get_latest_analysis(pull_request_id)


def get_findings(session: Session, pull_request_id: str) -> list[dict]:
    job = session.scalar(
        select(AnalysisJob)
        .where(
            AnalysisJob.pull_request_id == pull_request_id,
            AnalysisJob.status == "completed",
        )
        .order_by(AnalysisJob.completed_at.desc())
        .limit(1)
    )
    if job:
        rows = session.scalars(
            select(AnalysisFinding).where(AnalysisFinding.job_id == job.id)
        ).all()
        if rows:
            return [_finding_to_api(r) for r in rows]

    if session.get(PullRequest, pull_request_id):
        return seed.list_findings(pull_request_id)
    return []


def list_security_findings(session: Session) -> list[dict]:
    rows = session.scalars(
        select(AnalysisFinding).where(AnalysisFinding.type == "security")
    ).all()
    if rows:
        return [_finding_to_api(r) for r in rows]
    return seed.list_security_findings()
