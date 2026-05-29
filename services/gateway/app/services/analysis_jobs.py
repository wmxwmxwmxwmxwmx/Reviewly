"""Analysis job orchestration (B1 in-memory → B2 DB → B4 pipeline)."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.grpc_client.engine import get_engine_client
from app.mock import seed
from app.repositories import analysis as analysis_repo
from app.repositories import pull_requests as pr_repo


def _default_summary(pull_request_id: str) -> dict[str, Any] | None:
    return seed.get_latest_analysis(pull_request_id)


async def run_job(session: Session, job_id: str) -> None:
    job_api = analysis_repo.get_job(session, job_id)
    if not job_api:
        return

    pr_id = job_api["pullRequestId"]
    analysis_repo.update_job(session, job_id, status="running")

    client = get_engine_client()
    findings_list: list[dict[str, Any]] = []
    diff_files = pr_repo.get_diff(session, pr_id)
    file_paths = [f["path"] for f in diff_files]
    patch = ""

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
            analysis_repo.update_job(
                session,
                job_id,
                status=progress.get("status", "running"),
                progress=progress.get("progress", 0),
                chunkIndex=progress.get("chunkIndex", 0),
                chunkTotal=progress.get("chunkTotal", 0),
            )
            if progress.get("findings"):
                findings_list = progress["findings"]
            if progress.get("status") == "failed":
                analysis_repo.update_job(
                    session,
                    job_id,
                    status="failed",
                    error=progress.get("error", "分析失败"),
                )
                return
    except Exception as exc:  # noqa: BLE001
        analysis_repo.update_job(session, job_id, status="failed", error=str(exc))
        return

    if not findings_list:
        findings_list = seed.list_findings(pr_id)

    analysis_repo.save_findings(session, job_id, findings_list)
    summary = _default_summary(pr_id)
    analysis_repo.update_job(
        session,
        job_id,
        status="completed",
        progress=100,
        resultSummary=summary,
        completedAt=True,
    )


def create_job(session: Session, pull_request_id: str) -> dict[str, Any]:
    if pr_repo.get_pull_request(session, pull_request_id) is None:
        raise KeyError(pull_request_id)

    diff = pr_repo.get_diff(session, pull_request_id)
    job = analysis_repo.create_job(session, pull_request_id, len(diff) or 1)
    return {"jobId": job.id, "_schedule": job.id}


def get_job(session: Session, job_id: str) -> dict[str, Any] | None:
    return analysis_repo.get_job(session, job_id)


def get_latest_analysis(session: Session, pull_request_id: str) -> dict[str, Any] | None:
    return analysis_repo.get_latest_analysis(session, pull_request_id)


def get_findings(session: Session, pull_request_id: str) -> list[dict[str, Any]]:
    return analysis_repo.get_findings(session, pull_request_id)
