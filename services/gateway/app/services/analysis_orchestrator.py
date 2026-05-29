"""Enqueue and schedule PR analysis jobs."""
from __future__ import annotations

import asyncio
import logging
import threading

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


def enqueue_analysis(pull_request_id: str) -> str | None:
    session = SessionLocal()
    try:
        result = analysis_jobs.create_job(session, pull_request_id)
        job_id = result.get("_schedule") or result.get("jobId")
        session.commit()
        if not job_id:
            return None
        logger.info("Enqueued analysis job %s for PR %s", job_id, pull_request_id)
        return str(job_id)
    except KeyError:
        logger.warning("Cannot enqueue analysis: PR %s not found", pull_request_id)
        return None
    finally:
        session.close()


def enqueue_analysis_for_pr_ids(pr_ids: list[str], *, max_concurrent: int = 3) -> list[str]:
    job_ids: list[str] = []
    for pr_id in pr_ids[:max_concurrent]:
        jid = enqueue_analysis(pull_request_id=pr_id)
        if jid:
            job_ids.append(jid)
            schedule_analysis_background(jid)
    return job_ids
