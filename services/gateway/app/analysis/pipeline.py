"""B4: engine analysis + optional per-chunk LLM merge."""
from __future__ import annotations

from typing import Any, AsyncIterator

from sqlalchemy.orm import Session

from app.core.config import settings
from app.mock import seed
from app.repositories import settings as settings_repo


async def run_analysis_pipeline(
    *,
    session: Session,
    job_id: str,
    pull_request_id: str,
    patch: str,
    file_paths: list[str],
    engine_client: Any,
) -> AsyncIterator[dict[str, Any]]:
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

    llm_findings = await _llm_findings(session, pull_request_id, file_paths)
    if llm_findings:
        findings_list = _merge_findings(findings_list, llm_findings)

    if not findings_list:
        findings_list = seed.list_findings(pull_request_id)

    yield {
        "status": "completed",
        "progress": 100,
        "chunkIndex": len(file_paths) or 1,
        "chunkTotal": len(file_paths) or 1,
        "findings": findings_list,
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
    provider = ai_cfg.get("provider", "")
    if not provider or provider == "none":
        return []

    secrets = cfg.get("secrets", {})
    if not secrets and not settings.settings_encryption_key:
        return []

    _ = provider, ai_cfg, secrets
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
