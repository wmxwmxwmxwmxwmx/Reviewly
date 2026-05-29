"""B4: engine analysis + optional per-chunk LLM merge."""
from __future__ import annotations

from typing import Any, AsyncIterator

from sqlalchemy.orm import Session

from app.engine.summary import build_result_summary
from app.mock import seed
from app.repositories import settings as settings_repo
from app.services.llm_client import fetch_optional_review_finding


async def run_analysis_pipeline(
    *,
    session: Session,
    job_id: str,
    pull_request_id: str,
    patch: str,
    file_paths: list[str],
    engine_client: Any,
) -> AsyncIterator[dict[str, Any]]:
    _ = job_id
    findings_list: list[dict[str, Any]] = []
    chunk_paths = list(file_paths)

    async for progress in engine_client.run_analysis(
        job_id=job_id,
        pull_request_id=pull_request_id,
        patch=patch,
        file_paths=file_paths,
    ):
        if progress.get("chunkIndex"):
            idx = int(progress["chunkIndex"]) - 1
            if 0 <= idx < len(file_paths):
                chunk_paths = [file_paths[idx]]

        if progress.get("status") == "running" and chunk_paths:
            llm_extra = await _llm_findings(session, pull_request_id, chunk_paths)
            if llm_extra and progress.get("findings"):
                progress["findings"] = _merge_findings(progress["findings"], llm_extra)
            elif llm_extra:
                progress["findings"] = llm_extra

        yield progress

        if progress.get("findings"):
            findings_list = list(progress["findings"])
        if progress.get("status") == "failed":
            return

    if not findings_list and seed.is_demo_pr(pull_request_id):
        findings_list = seed.list_findings(pull_request_id)

    summary = build_result_summary(findings_list, pull_request_id)
    yield {
        "status": "completed",
        "progress": 100,
        "chunkIndex": len(file_paths) or 1,
        "chunkTotal": len(file_paths) or 1,
        "findings": findings_list,
        "resultSummary": summary,
    }


async def _llm_findings(
    session: Session,
    pull_request_id: str,
    file_paths: list[str],
) -> list[dict[str, Any]]:
    if not file_paths:
        return []

    cfg = settings_repo.get_settings(session)
    ai_cfg = cfg.get("ai", {})
    provider = str(ai_cfg.get("provider", "")).strip()
    if not provider or provider == "none":
        return []

    secrets = settings_repo.get_decrypted_secrets(session)
    api_key = secrets.get(provider) or secrets.get("apiKey") or secrets.get("default", "")
    if not api_key:
        return []

    try:
        return await fetch_optional_review_finding(
            provider=provider,
            model=str(ai_cfg.get("model", "")),
            api_key=api_key,
            pull_request_id=pull_request_id,
            file_paths=file_paths,
            custom_endpoint=ai_cfg.get("customEndpoint"),
        )
    except Exception:
        return []


def _merge_findings(
    engine_findings: list[dict[str, Any]],
    llm_findings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    seen = {f.get("id") for f in engine_findings}
    merged = list(engine_findings)
    for f in llm_findings:
        if f.get("id") not in seen:
            merged.append(f)
    return merged
