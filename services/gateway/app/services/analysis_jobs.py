"""Analysis job orchestration (B1 → B2 DB → B4 pipeline)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AnalysisJob, PullRequestDiff
from app.grpc_client.engine import get_engine_client
from app.repositories import analysis as analysis_repo
from app.repositories import pull_request_files as pr_files_repo
from app.repositories import pull_requests as pr_repo
from app.services import analysis_cache as cache


async def run_job(session: Session, job_id: str) -> None:
    job_api = analysis_repo.get_job(session, job_id)
    if not job_api:
        return

    pr_id = job_api["pullRequestId"]
    if not pr_id:
        return

    analysis_repo.update_job_phase(
        session, job_id, cache.PHASE_FETCHING_DIFF, progress=5, status="running"
    )

    client = get_engine_client()
    findings_list: list[dict[str, Any]] = []
    result_summary: dict[str, Any] | None = None

    stored_paths = pr_files_repo.file_paths(session, pr_id)
    if stored_paths:
        file_paths = stored_paths
        patch = pr_files_repo.build_combined_patch(session, pr_id)
    else:
        diff_files = pr_repo.get_diff(session, pr_id)
        file_paths = [f["path"] for f in diff_files]
        diff_row = session.scalar(
            select(PullRequestDiff).where(PullRequestDiff.pull_request_id == pr_id)
        )
        patch = diff_row.patch if diff_row and diff_row.patch else ""

    analysis_repo.update_job_phase(session, job_id, cache.PHASE_SCANNING, progress=10)

    from app.analysis.pipeline import run_analysis_pipeline

    try:
        async for progress in run_analysis_pipeline(
            session=session,
            job_id=job_id,
            pull_request_id=pr_id,
            patch=patch,
            file_paths=file_paths,
            engine_client=client,
        ):
            status = progress.get("status", "running")
            prog = int(progress.get("progress", 0))
            if status == "running":
                mapped = 10 + int(prog * 0.6) if prog <= 100 else prog
                analysis_repo.update_job_phase(
                    session, job_id, cache.PHASE_SCANNING, progress=min(mapped, 70), status="running"
                )
            if progress.get("findings"):
                findings_list = progress["findings"]
            if progress.get("resultSummary"):
                result_summary = progress["resultSummary"]
            if status == "failed":
                analysis_repo.update_job(
                    session,
                    job_id,
                    status="failed",
                    error=progress.get("error", "分析失败"),
                    phase=cache.PHASE_SCANNING,
                )
                return
    except Exception as exc:  # noqa: BLE001
        analysis_repo.update_job(session, job_id, status="failed", error=str(exc))
        return

    analysis_repo.update_job_phase(session, job_id, cache.PHASE_GENERATING_SUMMARY, progress=75)

    if not result_summary:
        from app.engine.summary import build_result_summary

        result_summary = build_result_summary(findings_list, pr_id)

    analysis_repo.update_job_phase(session, job_id, cache.PHASE_SAVING_RESULTS, progress=85)

    analysis_repo.save_findings(session, job_id, findings_list)

    from app.services.governance_evaluator import run_governance_check

    run_governance_check(
        session,
        pr_id,
        patch=patch,
        file_paths=file_paths,
        findings=findings_list,
    )

    analysis_repo.update_job(
        session,
        job_id,
        status="completed",
        progress=100,
        resultSummary=result_summary,
        completedAt=True,
        phase=cache.PHASE_COMPLETED,
    )

    from app.db.models import AnalysisJob
    from app.services.activity_helpers import pr_context
    from app.services.activity_log import record_activity

    job_row = session.get(AnalysisJob, job_id)
    repo_label, title, _ = pr_context(session, pr_id)
    duration_ms = 0
    if job_row and job_row.created_at and job_row.completed_at:
        duration_ms = int((job_row.completed_at - job_row.created_at).total_seconds() * 1000)
        job_row.duration_ms = duration_ms
        session.commit()

    record_activity(
        session,
        event_type="analysis_completed",
        actor="AI",
        action=f"完成了 PR 分析：{title}",
        repo=repo_label,
        pull_request_id=pr_id,
        payload={"jobId": job_id, "durationMs": duration_ms, "findingCount": len(findings_list)},
    )
    record_activity(
        session,
        event_type="review_completed",
        actor="AI",
        action=f"PR Review 已完成：{title}",
        repo=repo_label,
        pull_request_id=pr_id,
        payload={"jobId": job_id},
    )

    if job_row and job_row.analysis_version:
        cache.record_cache_event(
            session,
            pull_request_id=pr_id,
            analysis_version=job_row.analysis_version,
            job_id=job_id,
            cache_hit=False,
            saved_duration_ms=0,
        )
    session.commit()


def create_job(session: Session, pull_request_id: str, *, force: bool = False) -> dict[str, Any]:
    if pr_repo.get_pull_request(session, pull_request_id) is None:
        raise KeyError(pull_request_id)

    version, head_sha, base_sha, _full_name = cache.resolve_pr_version_context(session, pull_request_id)

    if not force:
        cached = cache.find_cached_completed_job(session, version)
        if cached is not None:
            saved_ms = cached.duration_ms or 0
            cache.record_cache_event(
                session,
                pull_request_id=pull_request_id,
                analysis_version=version,
                job_id=cached.id,
                cache_hit=True,
                saved_duration_ms=saved_ms,
            )
            session.commit()
            return {
                "jobId": cached.id,
                "queued": False,
                "cacheHit": True,
                "cached": True,
                "analysisVersion": version,
            }

    file_count = len(pr_files_repo.file_paths(session, pull_request_id))
    if not file_count:
        file_count = len(pr_repo.get_diff(session, pull_request_id))
    job = analysis_repo.create_job(
        session,
        pull_request_id,
        file_count or 1,
        analysis_version=version,
        head_sha=head_sha,
        base_sha=base_sha,
    )
    return {
        "jobId": job.id,
        "_schedule": job.id,
        "queued": True,
        "cacheHit": False,
        "cached": False,
        "analysisVersion": version,
    }


def get_job(session: Session, job_id: str) -> dict[str, Any] | None:
    return analysis_repo.get_job(session, job_id)


def get_latest_analysis(session: Session, pull_request_id: str) -> dict[str, Any] | None:
    return analysis_repo.get_latest_analysis(session, pull_request_id)


def get_findings(session: Session, pull_request_id: str) -> list[dict[str, Any]]:
    return analysis_repo.get_findings(session, pull_request_id)
