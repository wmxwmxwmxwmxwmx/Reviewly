"""Repository health score from PR/findings/jobs/architecture metrics (no AI)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest, Repository


def _open_finding_counts(
    session: Session, pr_ids_subq, *, severity: str | None = None, finding_type: str | None = None
) -> int:
    stmt = (
        select(func.count())
        .select_from(AnalysisFinding)
        .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
        .where(AnalysisJob.pull_request_id.in_(pr_ids_subq))
    )
    if severity:
        stmt = stmt.where(AnalysisFinding.severity == severity)
    if finding_type:
        stmt = stmt.where(AnalysisFinding.type == finding_type)
    rows = session.execute(stmt).scalar() or 0
    return int(rows)


def _open_findings_by_severity(session: Session, pr_ids_subq) -> dict[str, int]:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for sev in counts:
        counts[sev] = _open_finding_counts(session, pr_ids_subq, severity=sev)
    return counts


def compute_repo_health(session: Session, repo_id: str, open_pr_count: int) -> int:
    return compute_repo_health_detail(session, repo_id, open_pr_count)["score"]


def compute_repo_health_detail(
    session: Session, repo_id: str, open_pr_count: int
) -> dict[str, Any]:
    deductions: list[dict[str, Any]] = []
    score = 100

    pr_deduction = min(open_pr_count * 2, 20)
    if pr_deduction:
        score -= pr_deduction
        deductions.append(
            {
                "label": "开放合并请求",
                "count": open_pr_count,
                "points": pr_deduction,
            }
        )

    pr_ids_subq = select(PullRequest.id).where(PullRequest.repository_id == repo_id).scalar_subquery()

    sev_counts = _open_findings_by_severity(session, pr_ids_subq)
    for sev, weight, label in (
        ("critical", 10, "严重风险"),
        ("high", 10, "高危风险"),
        ("medium", 5, "中危风险"),
        ("low", 2, "低危风险"),
    ):
        count = sev_counts.get(sev, 0)
        if not count:
            continue
        points = count * weight
        score -= points
        deductions.append({"label": label, "count": count, "points": points})

    repo = session.get(Repository, repo_id)
    arch = (repo.architecture_graph or {}) if repo else {}
    metrics = arch.get("metrics") or {}
    for key, weight, label in (
        ("cycles", 3, "循环依赖"),
        ("giants", 2, "巨型模块"),
        ("layerViolations", 2, "分层违规"),
    ):
        count = int(metrics.get(key) or 0)
        if not count:
            continue
        points = count * weight
        score -= points
        deductions.append({"label": label, "count": count, "points": points})

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    failed_jobs = int(
        session.scalar(
            select(func.count())
            .select_from(AnalysisJob)
            .where(
                AnalysisJob.pull_request_id.in_(pr_ids_subq),
                AnalysisJob.status == "failed",
                AnalysisJob.created_at >= cutoff,
            )
        )
        or 0
    )
    if failed_jobs:
        points = failed_jobs * 10
        score -= points
        deductions.append(
            {
                "label": "近 7 日分析失败",
                "count": failed_jobs,
                "points": points,
            }
        )

    final_score = max(0, min(100, score))
    return {"score": final_score, "deductions": deductions}
