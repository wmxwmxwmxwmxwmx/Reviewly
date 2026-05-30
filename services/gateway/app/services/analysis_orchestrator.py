"""Enqueue and schedule PR analysis jobs."""
from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any

from app.db.session import SessionLocal
from app.services import analysis_jobs

logger = logging.getLogger(__name__)


def _run_job_sync(job_id: str) -> None:
    session = SessionLocal()
    try:
        asyncio.run(analysis_jobs.run_job(session, job_id))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Analysis job %s failed: %s", job_id, exc)
    finally:
        session.close()


def schedule_analysis_background(job_id: str) -> None:
    threading.Thread(target=_run_job_sync, args=(job_id,), daemon=True).start()


def enqueue_analysis(
    pull_request_id: str,
    *,
    force: bool = False,
) -> dict[str, Any] | None:
    session = SessionLocal()
    try:
        result = analysis_jobs.create_job(session, pull_request_id, force=force)
        schedule_id = result.pop("_schedule", None)
        session.commit()
        if schedule_id:
            schedule_analysis_background(str(schedule_id))
            logger.info("Enqueued analysis job %s for PR %s", schedule_id, pull_request_id)
        elif result.get("cacheHit"):
            logger.info(
                "Analysis cache hit for PR %s job=%s version=%s",
                pull_request_id,
                result.get("jobId"),
                result.get("analysisVersion"),
            )
        return result
    except KeyError:
        logger.warning("Cannot enqueue analysis: PR %s not found", pull_request_id)
        return None
    except ValueError as exc:
        logger.warning("Cannot enqueue analysis for PR %s: %s", pull_request_id, exc)
        return None
    finally:
        session.close()


def enqueue_analysis_for_pr_ids(pr_ids: list[str], *, max_concurrent: int = 3) -> list[str]:
    job_ids: list[str] = []
    for pr_id in pr_ids[:max_concurrent]:
        result = enqueue_analysis(pull_request_id=pr_id)
        if result and result.get("jobId"):
            job_ids.append(str(result["jobId"]))
    return job_ids
