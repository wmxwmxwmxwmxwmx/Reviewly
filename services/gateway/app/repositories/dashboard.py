from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest, Repository
from app.repositories import repository_jobs as rjob_repo
from app.repositories import settings as settings_repo
from app.repositories.seed_filter import (
    exclude_seed_findings,
    exclude_seed_repositories,
    is_seed_pull_request,
    is_stats_eligible_repository,
    only_stats_eligible_findings,
    only_stats_eligible_repositories,
)
from app.services.activity_log import list_recent
from app.services.analysis_cache import aggregate_cache_stats


def _count_active_analysis_jobs(session: Session) -> int:
    count = session.scalar(
        select(func.count())
        .select_from(AnalysisJob)
        .where(AnalysisJob.status.in_(("pending", "running")))
    )
    return int(count or 0)


def _running_tasks(session: Session) -> dict[str, int]:
    return {
        "pullRequests": rjob_repo.count_active_jobs_by_types(session, ["sync_prs"]),
        "aiReview": _count_active_analysis_jobs(session),
        "security": rjob_repo.count_active_jobs_by_types(session, ["security"]),
        "governance": 0,
        "performance": rjob_repo.count_active_jobs_by_types(session, ["performance"]),
    }


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


def _count_findings(session: Session, finding_type: str) -> int:
    stmt = only_stats_eligible_findings(
        exclude_seed_findings(
            select(func.count(AnalysisFinding.id))
            .select_from(AnalysisFinding)
            .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
            .outerjoin(PullRequest, AnalysisJob.pull_request_id == PullRequest.id)
            .join(
                Repository,
                or_(
                    PullRequest.repository_id == Repository.id,
                    AnalysisJob.repository_id == Repository.id,
                ),
            )
            .where(AnalysisFinding.type == finding_type)
        )
    )
    return session.scalar(stmt) or 0


def _scoped_repository_ids(
    session: Session,
    *,
    user_id: str | None,
    team_ids: list[str],
) -> set[str] | None:
    if not user_id:
        return None
    from app.repositories import repos as repos_repo

    rows = repos_repo.list_repos(session, user_id=user_id, team_ids=team_ids, repo_type="github")
    return {str(r["id"]) for r in rows}


def _empty_dashboard(session: Session) -> dict:
    return {
        "pendingPrs": 0,
        "securityIssues": 0,
        "qualityScore": 0,
        "avgReviewHours": 0,
        "summary": {
            "openPrCount": 0,
            "highRiskCount": 0,
            "securityCount": 0,
            "performanceCount": 0,
        },
        "recentReviews": [],
        "activities": [],
        "recentActivity": [],
        "topRepos": [],
        "riskDistribution": {"critical": 0, "high": 0, "medium": 0, "low": 0},
        "analysisTiming": {
            "avgDurationMs": 0,
            "completedCount": 0,
            "recent": [],
        },
        "weeklySummary": settings_repo.get_dashboard_weekly_summary(session),
        "runningTasks": _running_tasks(session),
    }


def _enrich_dashboard(
    session: Session,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> dict:
    team_ids = team_ids or []
    scoped_repo_ids = _scoped_repository_ids(session, user_id=user_id, team_ids=team_ids)

    open_prs_query = select(PullRequest).where(PullRequest.state == "open")
    open_prs = session.scalars(open_prs_query).all()
    if open_prs:
        open_pr_repo_map = {
            r.id: r
            for r in session.scalars(
                select(Repository).where(
                    Repository.id.in_({pr.repository_id for pr in open_prs})
                )
            ).all()
        }
        open_prs = [
            pr
            for pr in open_prs
            if (repo_row := open_pr_repo_map.get(pr.repository_id)) is not None
            and not is_seed_pull_request(pr, repo=repo_row)
            and is_stats_eligible_repository(repo_row)
        ]
    if scoped_repo_ids is not None:
        open_prs = [pr for pr in open_prs if pr.repository_id in scoped_repo_ids]

    security_count = _count_findings(session, "security")
    performance_count = _count_findings(session, "performance")

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
        if pr is None:
            continue
        job_repo = session.get(Repository, pr.repository_id)
        if job_repo is not None and is_seed_pull_request(pr, repo=job_repo):
            continue
        if job_repo is not None and not is_stats_eligible_repository(job_repo):
            continue
        if scoped_repo_ids is not None and pr.repository_id not in scoped_repo_ids:
            continue
        payload = pr.payload or {}
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

    activities = list_recent(session, limit=20, connected_only=True)

    repos_query = only_stats_eligible_repositories(exclude_seed_repositories(select(Repository)))
    if scoped_repo_ids is not None:
        if not scoped_repo_ids:
            repos = []
        else:
            repos = session.scalars(repos_query.where(Repository.id.in_(scoped_repo_ids))).all()
    else:
        repos = session.scalars(repos_query).all()

    top_repos = []
    for repo in repos[:5]:
        if repo.id.startswith("inst-"):
            continue
        payload = repo.payload or {}
        repo_pr_count = sum(1 for pr in open_prs if pr.repository_id == repo.id)
        issue_count = session.scalar(
            only_stats_eligible_findings(
                exclude_seed_findings(
                    select(func.count())
                    .select_from(AnalysisFinding)
                    .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
                    .outerjoin(PullRequest, AnalysisJob.pull_request_id == PullRequest.id)
                    .join(
                        Repository,
                        or_(
                            PullRequest.repository_id == Repository.id,
                            AnalysisJob.repository_id == Repository.id,
                        ),
                    )
                    .where(
                        or_(
                            PullRequest.repository_id == repo.id,
                            AnalysisJob.repository_id == repo.id,
                        )
                    )
                )
            )
        ) or 0
        full_name = payload.get("fullName", repo.full_name)
        top_repos.append(
            {
                "id": repo.id,
                "name": full_name.split("/")[-1] if "/" in full_name else full_name,
                "fullName": full_name,
                "prs": repo_pr_count or payload.get("openPrCount", 0),
                "issues": issue_count,
            }
        )

    avg_duration = int(sum(durations) / len(durations)) if durations else 0
    quality = 0
    if completed_jobs and completed_jobs[0].result_summary:
        scores = [
            completed_jobs[0].result_summary.get("maintainabilityScore"),
            completed_jobs[0].result_summary.get("securityScore"),
            completed_jobs[0].result_summary.get("performanceScore"),
        ]
        nums = [s for s in scores if isinstance(s, (int, float))]
        if nums:
            quality = int(sum(nums) / len(nums))

    return {
        "pendingPrs": open_pr_count,
        "securityIssues": security_count,
        "qualityScore": quality,
        "avgReviewHours": round(avg_duration / 3_600_000, 1) if avg_duration else 0,
        "summary": {
            "openPrCount": open_pr_count,
            "highRiskCount": high_risk_count,
            "securityCount": security_count,
            "performanceCount": performance_count,
        },
        "recentReviews": recent_reviews,
        "activities": activities,
        "recentActivity": activities,
        "topRepos": top_repos,
        "riskDistribution": risk_distribution,
        "analysisTiming": {
            "avgDurationMs": avg_duration,
            "completedCount": len(durations),
            "recent": timing_recent[:5],
        },
        "weeklySummary": settings_repo.get_dashboard_weekly_summary(session),
        "runningTasks": _running_tasks(session),
        "analysisCache": aggregate_cache_stats(session),
    }


def get_dashboard(
    session: Session,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> dict:
    return _enrich_dashboard(session, user_id=user_id, team_ids=team_ids or [])
