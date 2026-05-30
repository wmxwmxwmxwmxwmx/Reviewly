"""B4: engine analysis (per-chunk LLM removed to reduce token waste)."""
from __future__ import annotations

from typing import Any, AsyncIterator

from sqlalchemy.orm import Session


async def run_analysis_pipeline(
    *,
    session: Session,
    job_id: str,
    pull_request_id: str,
    patch: str,
    file_paths: list[str],
    engine_client: Any,
) -> AsyncIterator[dict[str, Any]]:
    _ = session, patch
    findings_list: list[dict[str, Any]] = []

    async for progress in engine_client.run_analysis(
        job_id=job_id,
        pull_request_id=pull_request_id,
        patch=patch,
        file_paths=file_paths,
    ):
        yield progress

        if progress.get("findings"):
            findings_list = list(progress["findings"])
        if progress.get("status") == "failed":
            return

    from app.engine.summary import build_result_summary

    summary = build_result_summary(findings_list, pull_request_id)
    yield {
        "status": "completed",
        "progress": 100,
        "chunkIndex": len(file_paths) or 1,
        "chunkTotal": len(file_paths) or 1,
        "findings": findings_list,
        "resultSummary": summary,
    }
