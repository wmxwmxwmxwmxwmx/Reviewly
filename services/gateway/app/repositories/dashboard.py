from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest, Repository
from app.mock import seed
from app.services.activity_log import list_recent


def _risk_level_from_pr(pr: PullRequest) -> str:
    payload = pr.payload or {}
    level = payload.get("riskLevel")
    if level:
        return str(level)
    score = pr.risk_score or 0
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _is_high_risk(level: str) -> bool:
    return level in ("high", "critical")


def _enrich_dashboard(base: dict, session: Session) -> dict:
    open_prs = session.scalars(select(PullRequest).where(PullRequest.state == "open")).all()

    security_count = session.scalar(
        select(func.count())
        .select_from(AnalysisFinding)
        .where(AnalysisFinding.type == "security")
    ) or 0
    performance_count = session.scalar(
        select(func.count())
        .select_from(AnalysisFinding)
        .where(AnalysisFinding.type == "performance")
    ) or 0

    high_risk_count = sum(1 for pr in open_prs if _is_high_risk(_risk_level_from_pr(pr)))
    open_pr_count = len(open_prs)

    risk_distribution: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for pr in open_prs:
        level = _risk_level_from_pr(pr)
        if level not in risk_distribution:
            risk_distribution[level] = 0
        risk_distribution[level] = risk_distribution.get(level, 0) + 1

    completed_jobs = session.scalars(
        select(AnalysisJob)
        .where(AnalysisJob.status == "completed")
        .order_by(AnalysisJob.completed_at.desc())
        .limit(10)
    ).all()

    recent_reviews: list[dict] = []
    timing_recent: list[dict] = []
    durations: list[int] = []

    for job in completed_jobs:
        pr = session.get(PullRequest, job.pull_request_id)
        payload = pr.payload if pr else {}
        summary = job.result_summary or {}
        duration_ms = 0
        if job.created_at and job.completed_at:
            ca = job.created_at
            co = job.completed_at
            if ca.tzinfo is None:
                ca = ca.replace(tzinfo=timezone.utc)
            if co.tzinfo is None:
                co = co.replace(tzinfo=timezone.utc)
            duration_ms = int((co - ca).total_seconds() * 1000)
            durations.append(duration_ms)

        completed_at = (
            job.completed_at.isoformat().replace("+00:00", "Z") if job.completed_at else ""
        )
        recent_reviews.append(
            {
                "pullRequestId": job.pull_request_id,
                "title": payload.get("title", f"PR #{pr.number if pr else '?'}"),
                "riskScore": summary.get("riskScore", pr.risk_score if pr else 0),
                "completedAt": completed_at,
                "mergeRecommendation": summary.get("mergeRecommendation", "comment"),
                "jobId": job.id,
            }
        )
        timing_recent.append(
            {
                "jobId": job.id,
                "pullRequestId": job.pull_request_id,
                "durationMs": duration_ms,
                "completedAt": completed_at,
            }
        )

    activities = list_recent(session, limit=20)
    if not activities:
        activities = base.get("recentActivity", [])

    repos = session.scalars(select(Repository)).all()
    top_repos = []
    for repo in repos[:5]:
        if repo.id.startswith("inst-"):
            continue
        payload = repo.payload or {}
        repo_pr_count = sum(1 for pr in open_prs if pr.repository_id == repo.id)
        issue_count = session.scalar(
            select(func.count())
            .select_from(AnalysisFinding)
            .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
            .join(PullRequest, AnalysisJob.pull_request_id == PullRequest.id)
            .where(PullRequest.repository_id == repo.id)
        ) or 0
        top_repos.append(
            {
                "name": payload.get("fullName", repo.full_name).split("/")[-1],
                "prs": repo_pr_count or payload.get("openPrCount", 0),
                "issues": issue_count,
                "health": payload.get("healthScore", 80),
            }
        )

    avg_duration = int(sum(durations) / len(durations)) if durations else 0
    quality = 87
    if completed_jobs and completed_jobs[0].result_summary:
        scores = [
            completed_jobs[0].result_summary.get("maintainabilityScore"),
            completed_jobs[0].result_summary.get("securityScore"),
            completed_jobs[0].result_summary.get("performanceScore"),
        ]
        nums = [s for s in scores if isinstance(s, (int, float))]
        if nums:
            quality = int(sum(nums) / len(nums))

    result = deepcopy(base)
    result["pendingPrs"] = open_pr_count or result.get("pendingPrs", 0)
    result["securityIssues"] = security_count or result.get("securityIssues", 0)
    result["qualityScore"] = quality
    result["avgReviewHours"] = round(avg_duration / 3_600_000, 1) if avg_duration else result.get("avgReviewHours", 2.4)
    result["recentActivity"] = activities
    result["topRepos"] = top_repos or result.get("topRepos", [])
    result["summary"] = {
        "openPrCount": result["pendingPrs"],
        "highRiskCount": high_risk_count,
        "securityCount": result["securityIssues"],
        "performanceCount": performance_count,
    }
    result["recentReviews"] = recent_reviews
    result["activities"] = activities
    result["riskDistribution"] = risk_distribution
    result["analysisTiming"] = {
        "avgDurationMs": avg_duration,
        "completedCount": len(durations),
        "recent": timing_recent[:5],
    }
    return result


def get_dashboard(session: Session) -> dict:
    base = seed.get_dashboard()
    open_prs = session.scalar(
        select(func.count()).select_from(PullRequest).where(PullRequest.state == "open")
    )
    if open_prs == 0:
        base["summary"] = {
            "openPrCount": base.get("pendingPrs", 12),
            "highRiskCount": 0,
            "securityCount": base.get("securityIssues", 5),
            "performanceCount": 0,
        }
        base["recentReviews"] = []
        base["activities"] = base.get("recentActivity", [])
        base["riskDistribution"] = {"critical": 1, "high": 2, "medium": 5, "low": 4}
        base["analysisTiming"] = {
            "avgDurationMs": 0,
            "completedCount": 0,
            "recent": [],
        }
        return base

    return _enrich_dashboard(base, session)
