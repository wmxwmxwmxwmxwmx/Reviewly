"""Review center: comments, timeline, status, stats, repo groups."""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import (
    AnalysisFinding,
    AnalysisJob,
    AuthUser,
    PullRequest,
    Repository,
    ReviewComment,
    ReviewTimelineEvent,
    Team,
)
from app.repositories import pull_requests as pr_repo

REVIEW_STATUSES = frozenset(
    {"OPEN", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "MERGED", "CLOSED"}
)
COMMENT_TYPES = frozenset({"COMMENT", "APPROVE", "REQUEST_CHANGES"})

STATUS_LABELS = {
    "OPEN": "等待评审",
    "IN_REVIEW": "评审中",
    "CHANGES_REQUESTED": "要求修改",
    "APPROVED": "已批准",
    "MERGED": "已合并",
    "CLOSED": "已关闭",
}


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def map_github_state_to_review_status(state: str) -> str:
    normalized = (state or "open").lower()
    if normalized == "merged":
        return "MERGED"
    if normalized == "closed":
        return "CLOSED"
    return "OPEN"


def append_timeline_event(
    session: Session,
    *,
    pull_request_id: str,
    event_type: str,
    actor: str,
    actor_type: str = "system",
    content: str | None = None,
    payload: dict | None = None,
) -> ReviewTimelineEvent:
    row = ReviewTimelineEvent(
        id=_new_id("rtl"),
        pull_request_id=pull_request_id,
        event_type=event_type,
        actor=actor,
        actor_type=actor_type,
        content=content,
        payload=payload,
    )
    session.add(row)
    return row


def record_pr_created(session: Session, pr_id: str, author: str) -> None:
    append_timeline_event(
        session,
        pull_request_id=pr_id,
        event_type="PR_CREATED",
        actor=author or "未知作者",
        actor_type="user",
        content="创建 PR",
    )


def record_ai_analysis_complete(session: Session, pr_id: str) -> None:
    append_timeline_event(
        session,
        pull_request_id=pr_id,
        event_type="AI_ANALYSIS_COMPLETE",
        actor="AI Reviewer",
        actor_type="ai",
        content="AI 完成分析",
    )


def update_review_status(
    session: Session,
    pr_id: str,
    status: str,
    *,
    user: AuthUser | None = None,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> dict | None:
    if status not in REVIEW_STATUSES:
        return None
    row = session.get(PullRequest, pr_id)
    if row is None:
        return None
    if user_id and not pr_repo._user_can_access_pr(session, row, user_id=user_id, team_ids=team_ids):
        return None
    previous = row.review_status or "OPEN"
    if previous == status:
        repo = session.get(Repository, row.repository_id)
        return pr_repo._pr_dict(row, repo=repo)

    row.review_status = status
    actor_name = user.username if user else "评审者"
    event_content = STATUS_LABELS.get(status, status)
    event_type = status
    if status == "IN_REVIEW" and previous == "OPEN":
        event_content = f"{actor_name} 开始评审"
        event_type = "REVIEW_STARTED"
    elif status == "OPEN" and previous != "OPEN":
        event_content = f"{actor_name} 将 PR 标为待评审"
        event_type = "STATUS_RESET"

    append_timeline_event(
        session,
        pull_request_id=pr_id,
        event_type=event_type,
        actor=actor_name,
        actor_type="user",
        content=event_content,
        payload={"from": previous, "to": status},
    )
    session.commit()
    repo = session.get(Repository, row.repository_id)
    return pr_repo._pr_dict(row, repo=repo)


def count_by_review_status(
    session: Session,
    *,
    repo_id: str | None = None,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> dict[str, int]:
    items = pr_repo.list_pull_requests(
        session,
        repo_id=repo_id,
        include_external=True,
        user_id=user_id,
        team_ids=team_ids,
    )
    counts: dict[str, int] = {s: 0 for s in REVIEW_STATUSES}
    counts["ALL"] = len(items)
    for item in items:
        status = item.get("reviewStatus") or "OPEN"
        if status in counts:
            counts[status] += 1
    return counts


def list_review_comments(
    session: Session,
    pr_id: str,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> list[dict[str, Any]] | None:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return None
    if user_id and not pr_repo._user_can_access_pr(session, row, user_id=user_id, team_ids=team_ids):
        return None
    rows = session.scalars(
        select(ReviewComment)
        .where(ReviewComment.pull_request_id == pr_id)
        .order_by(ReviewComment.created_at.asc())
    ).all()
    return [_comment_dict(r) for r in rows]


def add_review_comment(
    session: Session,
    pr_id: str,
    *,
    comment_type: str,
    content: str,
    user: AuthUser | None = None,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> dict[str, Any] | None:
    if comment_type not in COMMENT_TYPES:
        return None
    content = content.strip()
    if not content and comment_type == "COMMENT":
        return None

    row = session.get(PullRequest, pr_id)
    if row is None:
        return None
    if user_id and not pr_repo._user_can_access_pr(session, row, user_id=user_id, team_ids=team_ids):
        return None

    actor_name = user.username if user else "评审者"
    comment = ReviewComment(
        id=_new_id("rc"),
        pull_request_id=pr_id,
        user_id=user.id if user else user_id,
        user_name=actor_name,
        comment_type=comment_type,
        content=content or _default_comment_for_type(comment_type),
    )
    session.add(comment)

    if comment_type == "APPROVE":
        row.review_status = "APPROVED"
        event_type = "APPROVED"
        event_content = f"{actor_name} 批准了 PR"
    elif comment_type == "REQUEST_CHANGES":
        row.review_status = "CHANGES_REQUESTED"
        event_type = "CHANGES_REQUESTED"
        event_content = f"{actor_name} 要求修改"
    else:
        if row.review_status in ("OPEN", "CHANGES_REQUESTED"):
            row.review_status = "IN_REVIEW"
        event_type = "COMMENT"
        event_content = f"{actor_name} 发表了评论"

    append_timeline_event(
        session,
        pull_request_id=pr_id,
        event_type=event_type,
        actor=actor_name,
        actor_type="user",
        content=content or event_content,
    )
    session.commit()
    session.refresh(comment)
    return {**_comment_dict(comment), "reviewStatus": row.review_status or "OPEN"}


def _default_comment_for_type(comment_type: str) -> str:
    if comment_type == "APPROVE":
        return "批准合并"
    if comment_type == "REQUEST_CHANGES":
        return "请修改后重新提交"
    return ""


def _comment_dict(row: ReviewComment) -> dict[str, Any]:
    return {
        "id": row.id,
        "prId": row.pull_request_id,
        "userId": row.user_id,
        "userName": row.user_name,
        "type": row.comment_type,
        "content": row.content,
        "createdAt": row.created_at.isoformat() if row.created_at else "",
    }


def list_timeline(
    session: Session,
    pr_id: str,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> list[dict[str, Any]] | None:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return None
    if user_id and not pr_repo._user_can_access_pr(session, row, user_id=user_id, team_ids=team_ids):
        return None

    events = session.scalars(
        select(ReviewTimelineEvent)
        .where(ReviewTimelineEvent.pull_request_id == pr_id)
        .order_by(ReviewTimelineEvent.created_at.asc())
    ).all()

    if not events:
        _bootstrap_timeline(session, row)
        events = session.scalars(
            select(ReviewTimelineEvent)
            .where(ReviewTimelineEvent.pull_request_id == pr_id)
            .order_by(ReviewTimelineEvent.created_at.asc())
        ).all()

    return [_timeline_dict(e) for e in events]


def _bootstrap_timeline(session: Session, row: PullRequest) -> None:
    payload = row.payload or {}
    author = payload.get("author") or "未知作者"
    created_at = payload.get("createdAt")
    append_timeline_event(
        session,
        pull_request_id=row.id,
        event_type="PR_CREATED",
        actor=str(author),
        actor_type="user",
        content="创建 PR",
    )
    if created_at:
        first = session.scalar(
            select(ReviewTimelineEvent)
            .where(ReviewTimelineEvent.pull_request_id == row.id)
            .order_by(ReviewTimelineEvent.created_at.asc())
            .limit(1)
        )
        if first and first.created_at:
            pass

    job = session.scalar(
        select(AnalysisJob)
        .where(AnalysisJob.pull_request_id == row.id, AnalysisJob.status == "completed")
        .order_by(AnalysisJob.completed_at.desc())
        .limit(1)
    )
    if job:
        append_timeline_event(
            session,
            pull_request_id=row.id,
            event_type="AI_ANALYSIS_COMPLETE",
            actor="AI Reviewer",
            actor_type="ai",
            content="AI 完成分析",
        )

    ai_summary = payload.get("aiSummary")
    if isinstance(ai_summary, dict) and ai_summary.get("content"):
        append_timeline_event(
            session,
            pull_request_id=row.id,
            event_type="AI_SUMMARY_SAVED",
            actor="AI Reviewer",
            actor_type="ai",
            content="AI 生成评审摘要",
        )

    session.commit()


def _timeline_dict(row: ReviewTimelineEvent) -> dict[str, Any]:
    return {
        "id": row.id,
        "prId": row.pull_request_id,
        "eventType": row.event_type,
        "actor": row.actor,
        "actorType": row.actor_type,
        "content": row.content,
        "payload": row.payload,
        "createdAt": row.created_at.isoformat() if row.created_at else "",
    }


def _repo_team_group(repo: Repository) -> str:
    name = (repo.name or repo.full_name.split("/")[-1]).lower()
    language = (repo.language or "").lower()
    backend_kw = ("api", "auth", "payment", "service", "gateway", "backend", "server")
    frontend_kw = ("web", "admin", "ui", "frontend", "client", "app")
    ai_kw = ("ai", "ml", "engine", "prism", "model", "llm")
    if any(k in name for k in ai_kw) or language in ("python",) and "engine" in name:
        return "AI"
    if any(k in name for k in frontend_kw) or language in ("typescript", "javascript", "css"):
        return "Frontend"
    if any(k in name for k in backend_kw) or language in ("go", "java", "rust", "python"):
        return "Backend"
    if repo.team_id:
        team = None
        return "Backend"
    return "其他"


def list_repo_groups(
    session: Session,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    prs = pr_repo.list_pull_requests(
        session, include_external=True, user_id=user_id, team_ids=team_ids
    )
    repo_counts: dict[str, int] = defaultdict(int)
    for pr in prs:
        repo_counts[pr.get("repoId", "")] += 1

    repo_ids = [rid for rid in repo_counts if rid]
    if not repo_ids:
        return []

    repos = session.scalars(select(Repository).where(Repository.id.in_(repo_ids))).all()
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)

    team_names: dict[str, str] = {}
    team_ids_found = {r.team_id for r in repos if r.team_id}
    if team_ids_found:
        for team in session.scalars(select(Team).where(Team.id.in_(team_ids_found))).all():
            team_names[team.id] = team.name

    for repo in repos:
        if repo.team_id and repo.team_id in team_names:
            group_label = team_names[repo.team_id]
        else:
            group_label = _repo_team_group(repo)
        groups[group_label].append(
            {
                "id": repo.id,
                "name": repo.name or repo.full_name.split("/")[-1],
                "fullName": repo.full_name,
                "prCount": repo_counts.get(repo.id, 0),
                "language": repo.language,
            }
        )

    order = ["Backend", "Frontend", "AI", "其他"]
    result = []
    for label in order:
        if label in groups:
            repos_sorted = sorted(groups[label], key=lambda r: r["name"].lower())
            result.append({"id": label.lower(), "label": label, "repos": repos_sorted})
    for label, repos_list in groups.items():
        if label not in order:
            result.append(
                {
                    "id": label.lower(),
                    "label": label,
                    "repos": sorted(repos_list, key=lambda r: r["name"].lower()),
                }
            )
    return result


def get_dashboard(
    session: Session,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
    username: str | None = None,
) -> dict[str, Any]:
    items = pr_repo.list_pull_requests(
        session, include_external=True, user_id=user_id, team_ids=team_ids
    )
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    pending = [p for p in items if p.get("reviewStatus") in ("OPEN", "IN_REVIEW")]
    in_review = [p for p in items if p.get("reviewStatus") == "IN_REVIEW"]
    high_risk = [
        p
        for p in items
        if p.get("riskLevel") in ("critical", "high")
        and p.get("reviewStatus") not in ("MERGED", "CLOSED", "APPROVED")
    ]
    my_created = (
        [p for p in items if username and p.get("author", "").lower() == username.lower()]
        if username
        else []
    )

    pr_ids = [p["id"] for p in items]
    weekly_approvals = 0
    ai_findings = 0
    if pr_ids:
        weekly_approvals = session.scalar(
            select(func.count())
            .select_from(ReviewComment)
            .where(
                ReviewComment.pull_request_id.in_(pr_ids),
                ReviewComment.comment_type == "APPROVE",
                ReviewComment.created_at >= week_ago,
            )
        ) or 0

        job_ids = list(
            session.scalars(
                select(AnalysisJob.id).where(
                    AnalysisJob.pull_request_id.in_(pr_ids),
                    AnalysisJob.completed_at >= week_ago,
                )
            ).all()
        )
        if job_ids:
            ai_findings = session.scalar(
                select(func.count())
                .select_from(AnalysisFinding)
                .where(AnalysisFinding.job_id.in_(job_ids))
            ) or 0

    return {
        "pendingReview": len(pending),
        "inReview": len(in_review),
        "assignedToMe": len(in_review),
        "myCreated": len(my_created),
        "highRisk": len(high_risk),
        "weeklyApprovals": weekly_approvals,
        "aiFindingsThisWeek": ai_findings,
        "statusCounts": count_by_review_status(
            session, user_id=user_id, team_ids=team_ids
        ),
    }


def get_stats(
    session: Session,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> dict[str, Any]:
    items = pr_repo.list_pull_requests(
        session, include_external=True, user_id=user_id, team_ids=team_ids
    )
    pr_ids = [p["id"] for p in items]
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    weekly_analysis = 0
    if pr_ids:
        weekly_analysis = session.scalar(
            select(func.count())
            .select_from(AnalysisJob)
            .where(
                AnalysisJob.pull_request_id.in_(pr_ids),
                AnalysisJob.status == "completed",
                AnalysisJob.completed_at >= week_ago,
            )
        ) or 0

    approvals = 0
    rejections = 0
    if pr_ids:
        approvals = session.scalar(
            select(func.count())
            .select_from(ReviewComment)
            .where(
                ReviewComment.pull_request_id.in_(pr_ids),
                ReviewComment.comment_type == "APPROVE",
            )
        ) or 0
        rejections = session.scalar(
            select(func.count())
            .select_from(ReviewComment)
            .where(
                ReviewComment.pull_request_id.in_(pr_ids),
                ReviewComment.comment_type == "REQUEST_CHANGES",
            )
        ) or 0

    total_decisions = approvals + rejections
    approval_rate = approvals / total_decisions if total_decisions else 0
    rejection_rate = rejections / total_decisions if total_decisions else 0

    high_risk = len(
        [p for p in items if p.get("riskLevel") in ("critical", "high")]
    )

    total_tokens = 0
    cost_cny = 0.0
    for p in items:
        usage = (p.get("aiSummary") or {}).get("usage") if isinstance(p.get("aiSummary"), dict) else None
        if usage:
            total_tokens += int(usage.get("totalTokens") or 0)
            cost_cny += float(usage.get("costCny") or 0)

    daily_trend = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date()
        day_start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        count = 0
        if pr_ids:
            count = session.scalar(
                select(func.count())
                .select_from(AnalysisJob)
                .where(
                    AnalysisJob.pull_request_id.in_(pr_ids),
                    AnalysisJob.status == "completed",
                    AnalysisJob.completed_at >= day_start,
                    AnalysisJob.completed_at < day_end,
                )
            ) or 0
        daily_trend.append({"date": day.isoformat(), "analysisCount": count})

    return {
        "weeklyAnalysisCount": weekly_analysis,
        "aiCalls": weekly_analysis,
        "totalTokens": total_tokens,
        "costCny": round(cost_cny, 4),
        "approvalRate": round(approval_rate, 3),
        "rejectionRate": round(rejection_rate, 3),
        "avgApprovalHours": 0,
        "highRiskCount": high_risk,
        "dailyTrend": daily_trend,
    }


def check_approval_blocked(session: Session, pr_id: str) -> dict[str, Any]:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return {"blocked": True, "reasons": ["PR 不存在"]}
    payload = row.payload or {}
    security_score = int(payload.get("securityScore") or 100)
    critical_count = session.scalar(
        select(func.count())
        .select_from(AnalysisFinding)
        .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
        .where(
            AnalysisJob.pull_request_id == pr_id,
            AnalysisFinding.severity == "critical",
        )
    ) or 0
    reasons: list[str] = []
    if security_score < 60:
        reasons.append(f"安全评分过低（{security_score} < 60）")
    if critical_count > 0:
        reasons.append(f"存在 {critical_count} 个严重问题")
    return {"blocked": bool(reasons), "reasons": reasons, "securityScore": security_score, "criticalCount": critical_count}
