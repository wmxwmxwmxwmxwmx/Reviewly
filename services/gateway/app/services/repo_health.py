"""Repository health score from PR/findings/job aggregates (no AI)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest


def compute_repo_health(session: Session, repo_id: str, open_pr_count: int) -> int:
    base = 100
    base -= min(open_pr_count * 2, 20)

    pr_ids_subq = select(PullRequest.id).where(PullRequest.repository_id == repo_id).scalar_subquery()

    high_risk = session.scalar(
        select(func.count())
        .select_from(AnalysisFinding)
        .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
        .where(
            AnalysisJob.pull_request_id.in_(pr_ids_subq),
            AnalysisFinding.severity.in_(("critical", "high")),
        )
    ) or 0
    base -= high_risk * 5

    security = session.scalar(
        select(func.count())
        .select_from(AnalysisFinding)
        .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
        .where(
            AnalysisJob.pull_request_id.in_(pr_ids_subq),
            AnalysisFinding.type == "security",
        )
    ) or 0
    base -= security * 3

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    failed_jobs = session.scalar(
        select(func.count())
        .select_from(AnalysisJob)
        .where(
            AnalysisJob.pull_request_id.in_(pr_ids_subq),
            AnalysisJob.status == "failed",
            AnalysisJob.created_at >= cutoff,
        )
    ) or 0
    base -= failed_jobs * 10

    return max(0, min(100, base))
