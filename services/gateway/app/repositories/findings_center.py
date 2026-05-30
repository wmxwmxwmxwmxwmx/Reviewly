"""Unified findings center — security + performance over analysis_findings."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest, Repository
from app.repositories.ai_persisted import extract_from_payload
from app.repositories.performance_center import resolve_perf_type
from app.repositories.security_center import resolve_rule_label
from app.repositories.seed_filter import exclude_seed_findings, only_stats_eligible_findings

FINDING_TYPES = ("security", "performance")


def _dt_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def _to_unified_finding(
    row: AnalysisFinding,
    pr: PullRequest | None,
    repo: Repository,
    job: AnalysisJob,
) -> dict[str, Any]:
    payload = deepcopy(row.payload) if row.payload else {}
    pr_payload = (pr.payload or {}) if pr else {}
    repo_name = repo.full_name or str(pr_payload.get("repo") or "")
    description = str(payload.get("description") or row.title or "")
    suggestion = str(
        payload.get("suggestion")
        or payload.get("fixSuggestion")
        or payload.get("fix_suggestion")
        or ""
    )
    ftype = row.type
    if ftype == "security":
        rule_name = resolve_rule_label(payload, row.title)
        ai_key = "aiInsight"
    else:
        rule_name = resolve_perf_type(payload, row.title)
        ai_key = "aiOptimization"

    return {
        "id": row.id,
        "findingType": ftype,
        "typeLabel": "安全问题" if ftype == "security" else "性能问题",
        "repo": repo_name,
        "repoId": repo.id,
        "prNumber": pr.number if pr else 0,
        "pullRequestId": pr.id if pr else None,
        "file": row.file,
        "line": row.line,
        "severity": row.severity,
        "rule": rule_name,
        "description": description,
        "suggestion": suggestion,
        "status": payload.get("status", "open"),
        "title": row.title,
        "discoveredAt": _dt_iso(job.created_at),
        "aiInsight": extract_from_payload(payload, ai_key),
    }


def _base_query(
    session: Session,
    *,
    finding_types: list[str],
    severity: str | None,
    repo: str | None,
    repo_id: str | None,
    status: str | None,
    q: str | None,
):
    base = (
        select(AnalysisFinding, PullRequest, Repository, AnalysisJob)
        .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
        .outerjoin(PullRequest, AnalysisJob.pull_request_id == PullRequest.id)
        .join(
            Repository,
            or_(
                PullRequest.repository_id == Repository.id,
                AnalysisJob.repository_id == Repository.id,
            ),
        )
        .where(AnalysisFinding.type.in_(finding_types))
    )

    if severity:
        severities = [s.strip() for s in severity.split(",") if s.strip()]
        if severities:
            base = base.where(AnalysisFinding.severity.in_(severities))
    if repo_id:
        base = base.where(Repository.id == repo_id)
    elif repo:
        base = base.where(Repository.full_name.ilike(f"%{repo}%"))
    if q:
        pattern = f"%{q}%"
        base = base.where(
            or_(
                AnalysisFinding.title.ilike(pattern),
                AnalysisFinding.file.ilike(pattern),
                cast(AnalysisFinding.payload, String).ilike(pattern),
            )
        )
    if status:
        base = base.where(cast(AnalysisFinding.payload, String).ilike(f'%"status": "{status}"%'))

    return only_stats_eligible_findings(exclude_seed_findings(base))


def list_findings_filtered(
    session: Session,
    *,
    finding_type: str | None = None,
    severity: str | None = None,
    repo: str | None = None,
    repo_id: str | None = None,
    status: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort: str = "createdAt",
) -> tuple[list[dict[str, Any]], int]:
    types = FINDING_TYPES
    if finding_type in FINDING_TYPES:
        types = (finding_type,)

    base = _base_query(
        session,
        finding_types=list(types),
        severity=severity,
        repo=repo,
        repo_id=repo_id,
        status=status,
        q=q,
    )

    count_stmt = select(func.count()).select_from(base.subquery())
    total = int(session.scalar(count_stmt) or 0)
    if total == 0:
        return [], 0

    order = AnalysisJob.created_at.desc()
    if sort == "severity":
        order = AnalysisFinding.severity

    rows = session.execute(
        base.order_by(order, AnalysisFinding.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [_to_unified_finding(f, pr, repo_row, job) for f, pr, repo_row, job in rows]
    return items, total


def compute_stats(
    session: Session,
    *,
    finding_type: str | None = None,
    severity: str | None = None,
    repo: str | None = None,
    repo_id: str | None = None,
    status: str | None = None,
    q: str | None = None,
) -> dict[str, int]:
    types = list(FINDING_TYPES)
    if finding_type in FINDING_TYPES:
        types = [finding_type]

    base = _base_query(
        session,
        finding_types=types,
        severity=severity,
        repo=repo,
        repo_id=repo_id,
        status=status,
        q=q,
    )
    rows = session.execute(base).all()

    stats = {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
    for f, _, _, _ in rows:
        stats["total"] += 1
        sev = f.severity
        if sev in stats:
            stats[sev] += 1
    return stats


def compute_trends(
    session: Session,
    *,
    finding_type: str | None = None,
    severity: str | None = None,
    repo: str | None = None,
    repo_id: str | None = None,
    status: str | None = None,
    q: str | None = None,
    days: int = 7,
) -> list[dict[str, Any]]:
    types = list(FINDING_TYPES)
    if finding_type in FINDING_TYPES:
        types = [finding_type]

    since = datetime.now(timezone.utc) - timedelta(days=days)
    base = _base_query(
        session,
        finding_types=types,
        severity=severity,
        repo=repo,
        repo_id=repo_id,
        status=status,
        q=q,
    ).where(AnalysisJob.created_at >= since)

    rows = session.execute(base).all()
    buckets: dict[str, int] = {}
    for _, _, _, job in rows:
        if not job.created_at:
            continue
        day = job.created_at.astimezone(timezone.utc).strftime("%Y-%m-%d")
        buckets[day] = buckets.get(day, 0) + 1

    return [{"date": d, "count": buckets[d]} for d in sorted(buckets.keys())]


def get_finding(session: Session, finding_id: str) -> dict[str, Any] | None:
    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type not in FINDING_TYPES:
        return None
    job = session.get(AnalysisJob, row.job_id)
    if job is None:
        return None
    pr = session.get(PullRequest, job.pull_request_id) if job.pull_request_id else None
    repo_id = pr.repository_id if pr else job.repository_id
    if not repo_id:
        return None
    repo_row = session.get(Repository, repo_id)
    if repo_row is None:
        return None
    return _to_unified_finding(row, pr, repo_row, job)
