"""In-memory analysis job store (B1); B4 will orchestrate engine + LLM."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.grpc_client.engine import get_engine_client
from app.mock import seed

_jobs: dict[str, dict[str, Any]] = {}
_latest_by_pr: dict[str, dict[str, Any]] = {}
_findings_by_pr: dict[str, list[dict[str, Any]]] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def create_job(pull_request_id: str) -> dict[str, Any]:
    if seed.get_pull_request(pull_request_id) is None:
        raise KeyError(pull_request_id)

    job_id = f"job-{uuid.uuid4().hex[:12]}"
    job = {
        "id": job_id,
        "pullRequestId": pull_request_id,
        "status": "pending",
        "progress": 0,
        "chunkIndex": 0,
        "chunkTotal": len(seed.get_diff(pull_request_id)) or 1,
        "createdAt": _now_iso(),
    }
    _jobs[job_id] = job
    return {"jobId": job_id, "_schedule": job_id}


async def run_job(job_id: str) -> None:
    job = _jobs.get(job_id)
    if not job:
        return

    pr_id = job["pullRequestId"]
    job["status"] = "running"
    client = get_engine_client()
    findings_list: list[dict[str, Any]] = []

    try:
        async for progress in client.run_analysis(
            job_id=job_id,
            pull_request_id=pr_id,
            patch="",
            file_paths=[f["path"] for f in seed.get_diff(pr_id)],
        ):
            job["progress"] = progress.get("progress", job["progress"])
            job["chunkIndex"] = progress.get("chunkIndex", job["chunkIndex"])
            job["chunkTotal"] = progress.get("chunkTotal", job["chunkTotal"])
            if progress.get("findings"):
                findings_list = progress["findings"]
            if progress.get("status") == "failed":
                job["status"] = "failed"
                job["error"] = progress.get("error", "分析失败")
                return
    except Exception as exc:  # noqa: BLE001
        job["status"] = "failed"
        job["error"] = str(exc)
        return

    if not findings_list:
        findings_list = seed.list_findings(pr_id)

    _findings_by_pr[pr_id] = findings_list
    summary = seed.get_latest_analysis(pr_id)
    if summary:
        _latest_by_pr[pr_id] = summary

    job["status"] = "completed"
    job["progress"] = 100
    job["completedAt"] = _now_iso()


def get_job(job_id: str) -> dict[str, Any] | None:
    job = _jobs.get(job_id)
    return dict(job) if job else None


def get_latest_analysis(pull_request_id: str) -> dict[str, Any] | None:
    return _latest_by_pr.get(pull_request_id) or seed.get_latest_analysis(pull_request_id)


def get_findings(pull_request_id: str) -> list[dict[str, Any]]:
    return _findings_by_pr.get(pull_request_id) or seed.list_findings(pull_request_id)
