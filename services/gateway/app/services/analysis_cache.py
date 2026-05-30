"""PR analysis version cache keyed by owner/repo#number:head_sha."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AnalysisCacheEvent, AnalysisJob, PullRequest, Repository

PHASE_QUEUED = "queued"
PHASE_FETCHING_DIFF = "fetching_diff"
PHASE_SCANNING = "scanning"
PHASE_GENERATING_SUMMARY = "generating_summary"
PHASE_SAVING_RESULTS = "saving_results"
PHASE_COMPLETED = "completed"

ANALYSIS_PHASES = (
    PHASE_QUEUED,
    PHASE_FETCHING_DIFF,
    PHASE_SCANNING,
    PHASE_GENERATING_SUMMARY,
    PHASE_SAVING_RESULTS,
    PHASE_COMPLETED,
)


def extract_shas_from_github_pr(gh_pr: dict[str, Any]) -> tuple[str | None, str | None]:
    head = gh_pr.get("head") if isinstance(gh_pr.get("head"), dict) else {}
    base = gh_pr.get("base") if isinstance(gh_pr.get("base"), dict) else {}
    head_sha = head.get("sha") if isinstance(head.get("sha"), str) else None
    base_sha = base.get("sha") if isinstance(base.get("sha"), str) else None
    return head_sha, base_sha


def build_analysis_version(full_name: str, number: int, head_sha: str) -> str:
    return f"{full_name}#{number}:{head_sha}"


def resolve_pr_version_context(session: Session, pr_id: str) -> tuple[str, str | None, str | None, str]:
    """Return (analysis_version, head_sha, base_sha, full_name)."""
    row = session.get(PullRequest, pr_id)
    if row is None:
        raise KeyError(pr_id)

    head_sha = row.head_sha
    base_sha = row.base_sha
    full_name: str | None = None

    if row.payload and isinstance(row.payload, dict):
        head_sha = head_sha or row.payload.get("headSha") or row.payload.get("head_sha")
        base_sha = base_sha or row.payload.get("baseSha") or row.payload.get("base_sha")
        full_name = row.payload.get("repo") or row.payload.get("fullName")

    if not full_name:
        repo = session.get(Repository, row.repository_id)
        full_name = repo.full_name if repo else f"unknown/repo"

    if not head_sha:
        raise ValueError(f"PR {pr_id} has no head_sha; sync before analysis")

    version = row.analysis_version or build_analysis_version(full_name, row.number, head_sha)
    return version, head_sha, base_sha, full_name


def sync_pr_analysis_version(
    session: Session,
    pr_row: PullRequest,
    *,
    head_sha: str | None,
    base_sha: str | None,
    full_name: str | None = None,
) -> str | None:
    if not head_sha:
        return None
    pr_row.head_sha = head_sha
    if base_sha is not None:
        pr_row.base_sha = base_sha
    if pr_row.payload and isinstance(pr_row.payload, dict):
        pr_row.payload = {
            **pr_row.payload,
            "headSha": head_sha,
            "baseSha": base_sha,
        }
    name = full_name
    if not name:
        repo = session.get(Repository, pr_row.repository_id)
        name = repo.full_name if repo else None
    if name:
        pr_row.analysis_version = build_analysis_version(name, pr_row.number, head_sha)
    session.flush()
    return pr_row.analysis_version


def find_cached_completed_job(session: Session, analysis_version: str) -> AnalysisJob | None:
    if not analysis_version:
        return None
    return session.scalar(
        select(AnalysisJob)
        .where(
            AnalysisJob.analysis_version == analysis_version,
            AnalysisJob.status == "completed",
            AnalysisJob.cache_hit.is_(False),
        )
        .order_by(AnalysisJob.completed_at.desc())
        .limit(1)
    )


def estimate_cost_per_run_usd() -> Decimal:
    return Decimal(str(getattr(settings, "prism_analysis_cost_per_run_usd", 0.05)))


def record_cache_event(
    session: Session,
    *,
    pull_request_id: str,
    analysis_version: str,
    job_id: str | None,
    cache_hit: bool,
    saved_duration_ms: int = 0,
) -> None:
    cost = estimate_cost_per_run_usd() if cache_hit else Decimal("0")
    session.add(
        AnalysisCacheEvent(
            id=f"ace-{uuid.uuid4().hex[:12]}",
            pull_request_id=pull_request_id,
            analysis_version=analysis_version,
            job_id=job_id,
            cache_hit=cache_hit,
            saved_duration_ms=max(0, saved_duration_ms),
            estimated_cost_usd=cost,
        )
    )
    session.flush()


def aggregate_cache_stats(session: Session, *, days: int = 30) -> dict[str, Any]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = session.execute(
        select(
            AnalysisCacheEvent.cache_hit,
            func.count().label("cnt"),
            func.coalesce(func.sum(AnalysisCacheEvent.saved_duration_ms), 0).label("saved_ms"),
            func.coalesce(func.sum(AnalysisCacheEvent.estimated_cost_usd), 0).label("cost"),
        )
        .where(AnalysisCacheEvent.created_at >= since)
        .group_by(AnalysisCacheEvent.cache_hit)
    ).all()

    hits = 0
    misses = 0
    saved_ms = 0
    cost_saved = Decimal("0")
    for cache_hit, cnt, saved, cost in rows:
        n = int(cnt)
        if cache_hit:
            hits += n
            saved_ms += int(saved or 0)
            cost_saved += Decimal(str(cost or 0))
        else:
            misses += n

    total = hits + misses
    hit_rate = round((hits / total) * 100, 1) if total else 0.0

    return {
        "hitRate": hit_rate,
        "savedTimeMs": saved_ms,
        "savedTimeLabel": _format_duration(saved_ms),
        "estimatedCostSavedUsd": float(cost_saved),
        "hits": hits,
        "misses": misses,
    }


def _format_duration(ms: int) -> str:
    if ms <= 0:
        return "0m"
    hours = ms / 3_600_000
    if hours >= 1:
        return f"{hours:.1f}h"
    minutes = ms / 60_000
    return f"{minutes:.0f}m"
