from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest
from app.services.analysis_cache import PHASE_QUEUED


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
        "phase": job.phase or PHASE_QUEUED,
        "analysisVersion": job.analysis_version,
        "cacheHit": bool(job.cache_hit),
        "createdAt": job.created_at.isoformat().replace("+00:00", "Z") if job.created_at else _now_iso(),
        "completedAt": job.completed_at.isoformat().replace("+00:00", "Z") if job.completed_at else None,
        "error": job.error_message,
    }


def _finding_to_api(row: AnalysisFinding) -> dict:
    if row.payload:
        out = deepcopy(row.payload)
        out["id"] = row.id
        return out
    return {
        "id": row.id,
        "type": row.type,
        "severity": row.severity,
        "title": row.title,
        "file": row.file,
        "line": row.line,
    }


def _completed_job_query(pull_request_id: str, analysis_version: str | None):
    stmt = select(AnalysisJob).where(
        AnalysisJob.pull_request_id == pull_request_id,
        AnalysisJob.status == "completed",
    )
    if analysis_version:
        stmt = stmt.where(AnalysisJob.analysis_version == analysis_version)
    return stmt.order_by(AnalysisJob.completed_at.desc()).limit(1)


def _latest_completed_job(
    session: Session,
    pull_request_id: str,
    analysis_version: str | None,
) -> AnalysisJob | None:
    """Prefer job matching current analysis_version; fall back to latest completed."""
    if analysis_version:
        job = session.scalar(_completed_job_query(pull_request_id, analysis_version))
        if job is not None:
            return job
    return session.scalar(_completed_job_query(pull_request_id, None))


def create_job(
    session: Session,
    pull_request_id: str,
    chunk_total: int,
    *,
    analysis_version: str,
    head_sha: str,
    base_sha: str | None = None,
) -> AnalysisJob:
    import uuid

    job_id = f"job-{uuid.uuid4().hex[:12]}"
    job = AnalysisJob(
        id=job_id,
        pull_request_id=pull_request_id,
        status="pending",
        progress=0,
        chunk_index=0,
        chunk_total=max(chunk_total, 1),
        analysis_version=analysis_version,
        head_sha=head_sha,
        base_sha=base_sha,
        phase=PHASE_QUEUED,
        cache_hit=False,
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def get_job(session: Session, job_id: str) -> dict | None:
    job = session.get(AnalysisJob, job_id)
    return _job_to_api(job) if job else None


def get_job_row(session: Session, job_id: str) -> AnalysisJob | None:
    return session.get(AnalysisJob, job_id)


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
        elif key == "phase":
            job.phase = str(value) if value else None
        elif key == "error":
            job.error_message = str(value) if value else None
        elif key == "completedAt":
            job.completed_at = datetime.now(timezone.utc)
        elif key == "resultSummary":
            job.result_summary = value  # type: ignore[assignment]
        elif key == "durationMs":
            job.duration_ms = int(value)  # type: ignore[arg-type]
    session.commit()


def update_job_phase(
    session: Session,
    job_id: str,
    phase: str,
    *,
    progress: int | None = None,
    status: str | None = None,
) -> None:
    fields: dict[str, object] = {"phase": phase}
    if progress is not None:
        fields["progress"] = progress
    if status is not None:
        fields["status"] = status
    update_job(session, job_id, **fields)


def save_findings(session: Session, job_id: str, findings: list[dict]) -> None:
    job = session.get(AnalysisJob, job_id)
    pr_id = job.pull_request_id if job else None
    security_logged = False

    for i, f in enumerate(findings):
        raw_id = f.get("id") or f"finding-{i}"
        fid = raw_id if str(raw_id).startswith(f"{job_id}:") else f"{job_id}:{raw_id}"
        payload = deepcopy(f)
        payload["id"] = fid
        session.add(
            AnalysisFinding(
                id=fid,
                job_id=job_id,
                type=f.get("type", "security"),
                severity=f.get("severity", "medium"),
                title=f.get("title", ""),
                file=f.get("file", ""),
                line=int(f.get("line", 0)),
                payload=payload,
            )
        )
        if (
            not security_logged
            and f.get("type") == "security"
            and pr_id
        ):
            from app.services.activity_helpers import pr_context
            from app.services.activity_log import record_activity

            repo_label, _, _ = pr_context(session, pr_id)
            record_activity(
                session,
                event_type="security_finding",
                actor="AI",
                action=f"发现安全问题：{f.get('title', 'Security finding')}",
                repo=repo_label,
                pull_request_id=pr_id,
                payload={"findingId": fid, "severity": f.get("severity")},
            )
            security_logged = True
    session.commit()


def get_latest_analysis(session: Session, pull_request_id: str) -> dict | None:
    pr = session.get(PullRequest, pull_request_id)
    version = pr.analysis_version if pr else None
    job = _latest_completed_job(session, pull_request_id, version)
    if job and job.result_summary:
        return deepcopy(job.result_summary)
    return None


def get_findings(session: Session, pull_request_id: str) -> list[dict]:
    from app.db.models import Repository
    from app.repositories.seed_filter import is_seed_pull_request

    pr = session.get(PullRequest, pull_request_id)
    if pr is not None:
        repo = session.get(Repository, pr.repository_id)
        if repo is not None and is_seed_pull_request(pr, repo=repo):
            return []

    version = pr.analysis_version if pr else None
    job = _latest_completed_job(session, pull_request_id, version)
    if job:
        rows = session.scalars(
            select(AnalysisFinding).where(AnalysisFinding.job_id == job.id)
        ).all()
        return [_finding_to_api(r) for r in rows]

    return []


def list_security_findings(session: Session) -> list[dict]:
    from sqlalchemy import or_

    from app.db.models import Repository
    from app.repositories.seed_filter import exclude_seed_findings, only_stats_eligible_findings

    base = (
        select(AnalysisFinding)
        .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
        .outerjoin(PullRequest, AnalysisJob.pull_request_id == PullRequest.id)
        .join(
            Repository,
            or_(
                PullRequest.repository_id == Repository.id,
                AnalysisJob.repository_id == Repository.id,
            ),
        )
        .where(AnalysisFinding.type == "security")
    )
    stmt = only_stats_eligible_findings(exclude_seed_findings(base))
    rows = session.scalars(stmt).all()
    return [_finding_to_api(r) for r in rows]


def get_security_stats(session: Session) -> dict:
    findings = list_security_findings(session)
    critical = sum(1 for f in findings if f.get("severity") == "critical")
    high = sum(1 for f in findings if f.get("severity") == "high")
    medium = sum(1 for f in findings if f.get("severity") == "medium")
    return {
        "openFindings": len(findings),
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": len(findings) - critical - high - medium,
        "status": "ok",
    }
