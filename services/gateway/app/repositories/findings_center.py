"""Unified findings center — analysis findings + governance convention risks."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import String, cast, func, not_, or_, select
from sqlalchemy.orm import Session

from app.db.models import (
    AnalysisFinding,
    AnalysisJob,
    GovernanceRule,
    GovernanceViolation,
    PullRequest,
    Repository,
)
from app.repositories.ai_persisted import extract_from_payload
from app.repositories.performance_center import resolve_perf_type
from app.repositories.security_center import resolve_rule_label
from app.repositories.seed_filter import (
    exclude_seed_findings,
    only_stats_eligible_findings,
    only_stats_eligible_repositories,
    seed_pull_request_predicate,
)

ANALYSIS_TYPES = ("security", "performance", "architecture", "maintainability")
FINDING_TYPES = ANALYSIS_TYPES
CATEGORY_TYPES = (*ANALYSIS_TYPES, "convention")

TYPE_LABELS: dict[str, str] = {
    "security": "安全问题",
    "performance": "性能问题",
    "architecture": "架构问题",
    "maintainability": "可维护性",
    "convention": "规范问题",
}

SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}

GOV_ID_PREFIX = "gov-"


def _dt_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def _resolve_analysis_rule(ftype: str, payload: dict[str, Any], title: str) -> str:
    if ftype == "security":
        return resolve_rule_label(payload, title)
    if ftype == "performance":
        return resolve_perf_type(payload, title)
    if payload.get("rule"):
        return str(payload["rule"])
    return title or TYPE_LABELS.get(ftype, ftype)


def _open_status(payload: dict | None) -> str:
    return str((payload or {}).get("status", "open"))


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
    rule_name = _resolve_analysis_rule(ftype, payload, row.title)
    ai_key = "aiInsight" if ftype == "security" else "aiOptimization"

    return {
        "id": row.id,
        "findingType": ftype,
        "typeLabel": TYPE_LABELS.get(ftype, ftype),
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
        "status": _open_status(payload),
        "title": row.title,
        "discoveredAt": _dt_iso(job.created_at),
        "aiInsight": extract_from_payload(payload, ai_key),
    }


def _to_convention_finding(
    violation: GovernanceViolation,
    pr: PullRequest,
    repo: Repository,
    rule: GovernanceRule,
) -> dict[str, Any]:
    payload = deepcopy(violation.payload) if violation.payload else {}
    vpayload = payload
    description = str(
        vpayload.get("feedback")
        or vpayload.get("description")
        or rule.rule
        or "治理规则未通过"
    )
    suggestion = str(vpayload.get("suggestion") or "请按团队规范调整代码后重新提交。")
    pr_payload = pr.payload or {}
    repo_name = repo.full_name or str(pr_payload.get("repo") or "")
    discovered = vpayload.get("evaluatedAt")
    if isinstance(discovered, str):
        discovered_at = discovered
    else:
        discovered_at = None

    return {
        "id": f"{GOV_ID_PREFIX}{violation.id}",
        "findingType": "convention",
        "typeLabel": TYPE_LABELS["convention"],
        "repo": repo_name,
        "repoId": repo.id,
        "prNumber": pr.number,
        "pullRequestId": pr.id,
        "file": violation.file or "",
        "line": int(vpayload.get("line") or 0),
        "severity": rule.severity if rule.severity in SEVERITY_RANK else "medium",
        "rule": rule.rule[:120] if rule.rule else "Governance Rule",
        "description": description,
        "suggestion": suggestion,
        "status": _open_status(payload),
        "title": rule.rule[:80] if rule.rule else "规范违规",
        "discoveredAt": discovered_at,
        "aiInsight": extract_from_payload(payload, "aiInsight"),
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
                Repository.full_name.ilike(pattern),
                cast(AnalysisFinding.payload, String).ilike(pattern),
            )
        )
    if status:
        base = base.where(cast(AnalysisFinding.payload, String).ilike(f'%"status": "{status}"%'))

    return only_stats_eligible_findings(exclude_seed_findings(base))


def _list_analysis_findings(
    session: Session,
    *,
    finding_types: list[str],
    severity: str | None,
    repo: str | None,
    repo_id: str | None,
    status: str | None,
    q: str | None,
) -> list[dict[str, Any]]:
    base = _base_query(
        session,
        finding_types=finding_types,
        severity=severity,
        repo=repo,
        repo_id=repo_id,
        status=status,
        q=q,
    )
    rows = session.execute(base.order_by(AnalysisJob.created_at.desc(), AnalysisFinding.id.desc())).all()
    items: list[dict[str, Any]] = []
    for f, pr, repo_row, job in rows:
        payload = f.payload or {}
        if status is not None and _open_status(payload) != status:
            continue
        items.append(_to_unified_finding(f, pr, repo_row, job))
    return items


def _list_convention_findings(
    session: Session,
    *,
    severity: str | None,
    repo: str | None,
    repo_id: str | None,
    status: str | None,
    q: str | None,
) -> list[dict[str, Any]]:
    stmt = (
        only_stats_eligible_repositories(
            select(GovernanceViolation, PullRequest, Repository, GovernanceRule)
            .join(PullRequest, GovernanceViolation.pull_request_id == PullRequest.id)
            .join(Repository, PullRequest.repository_id == Repository.id)
            .join(GovernanceRule, GovernanceViolation.rule_id == GovernanceRule.id)
            .where(GovernanceViolation.violated.is_(True))
            .where(not_(seed_pull_request_predicate()))
        )
    )
    if repo_id:
        stmt = stmt.where(Repository.id == repo_id)
    elif repo:
        stmt = stmt.where(Repository.full_name.ilike(f"%{repo}%"))
    if severity:
        severities = [s.strip() for s in severity.split(",") if s.strip()]
        if severities:
            stmt = stmt.where(GovernanceRule.severity.in_(severities))
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                GovernanceRule.rule.ilike(pattern),
                GovernanceViolation.file.ilike(pattern),
                Repository.full_name.ilike(pattern),
                cast(GovernanceViolation.payload, String).ilike(pattern),
            )
        )

    rows = session.execute(stmt).all()
    items: list[dict[str, Any]] = []
    for violation, pr, repo_row, rule in rows:
        payload = violation.payload or {}
        st = _open_status(payload)
        if status is not None and st != status:
            continue
        items.append(_to_convention_finding(violation, pr, repo_row, rule))
    return items


def _sort_items(items: list[dict[str, Any]], sort: str) -> list[dict[str, Any]]:
    if sort == "severity":
        return sorted(
            items,
            key=lambda x: (
                SEVERITY_RANK.get(str(x.get("severity")), 9),
                str(x.get("discoveredAt") or ""),
            ),
        )
    return sorted(items, key=lambda x: str(x.get("discoveredAt") or ""), reverse=True)


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
    status_filter = status if status else None

    if finding_type == "convention":
        merged = _list_convention_findings(
            session,
            severity=severity,
            repo=repo,
            repo_id=repo_id,
            status=status_filter,
            q=q,
        )
    elif finding_type in ANALYSIS_TYPES:
        merged = _list_analysis_findings(
            session,
            finding_types=[finding_type],
            severity=severity,
            repo=repo,
            repo_id=repo_id,
            status=status_filter,
            q=q,
        )
    else:
        merged = _list_analysis_findings(
            session,
            finding_types=list(ANALYSIS_TYPES),
            severity=severity,
            repo=repo,
            repo_id=repo_id,
            status=status_filter,
            q=q,
        )
        merged.extend(
            _list_convention_findings(
                session,
                severity=severity,
                repo=repo,
                repo_id=repo_id,
                status=status_filter,
                q=q,
            )
        )

    merged = _sort_items(merged, sort)
    total = len(merged)
    start = (page - 1) * page_size
    page_items = merged[start : start + page_size]
    return page_items, total


def compute_stats(
    session: Session,
    *,
    finding_type: str | None = None,
    repo: str | None = None,
    repo_id: str | None = None,
) -> dict[str, int]:
    if finding_type == "convention":
        items = _list_convention_findings(
            session, severity=None, repo=repo, repo_id=repo_id, status="open", q=None
        )
    elif finding_type in ANALYSIS_TYPES:
        items = _list_analysis_findings(
            session,
            finding_types=[finding_type],
            severity=None,
            repo=repo,
            repo_id=repo_id,
            status="open",
            q=None,
        )
    else:
        items = _list_analysis_findings(
            session,
            finding_types=list(ANALYSIS_TYPES),
            severity=None,
            repo=repo,
            repo_id=repo_id,
            status="open",
            q=None,
        )
        items.extend(
            _list_convention_findings(
                session, severity=None, repo=repo, repo_id=repo_id, status="open", q=None
            )
        )

    stats = {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
    for item in items:
        stats["total"] += 1
        sev = item.get("severity")
        if sev in stats:
            stats[sev] += 1
    return stats


def compute_category_stats(
    session: Session,
    *,
    repo: str | None = None,
    repo_id: str | None = None,
) -> dict[str, Any]:
    counts = {key: 0 for key in CATEGORY_TYPES}
    max_severity: dict[str, str | None] = {key: None for key in CATEGORY_TYPES}

    for ftype in ANALYSIS_TYPES:
        items = _list_analysis_findings(
            session,
            finding_types=[ftype],
            severity=None,
            repo=repo,
            repo_id=repo_id,
            status="open",
            q=None,
        )
        counts[ftype] = len(items)
        for item in items:
            sev = str(item.get("severity"))
            prev = max_severity[ftype]
            if prev is None or SEVERITY_RANK.get(sev, 9) < SEVERITY_RANK.get(prev, 9):
                max_severity[ftype] = sev

    convention_items = _list_convention_findings(
        session, severity=None, repo=repo, repo_id=repo_id, status="open", q=None
    )
    counts["convention"] = len(convention_items)
    for item in convention_items:
        sev = str(item.get("severity"))
        prev = max_severity["convention"]
        if prev is None or SEVERITY_RANK.get(sev, 9) < SEVERITY_RANK.get(prev, 9):
            max_severity["convention"] = sev

    return {"counts": counts, "maxSeverity": max_severity}


def get_finding(session: Session, finding_id: str) -> dict[str, Any] | None:
    if finding_id.startswith(GOV_ID_PREFIX):
        vid = finding_id[len(GOV_ID_PREFIX) :]
        violation = session.get(GovernanceViolation, vid)
        if violation is None or not violation.violated:
            return None
        pr = session.get(PullRequest, violation.pull_request_id) if violation.pull_request_id else None
        if pr is None:
            return None
        repo_row = session.get(Repository, pr.repository_id)
        rule = session.get(GovernanceRule, violation.rule_id)
        if repo_row is None or rule is None:
            return None
        return _to_convention_finding(violation, pr, repo_row, rule)

    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type not in ANALYSIS_TYPES:
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


def patch_finding_status(
    session: Session,
    finding_id: str,
    *,
    status: str,
) -> dict[str, Any] | None:
    if status not in ("open", "ignored", "resolved"):
        return None

    if finding_id.startswith(GOV_ID_PREFIX):
        vid = finding_id[len(GOV_ID_PREFIX) :]
        violation = session.get(GovernanceViolation, vid)
        if violation is None:
            return None
        payload = deepcopy(violation.payload) if violation.payload else {}
        payload["status"] = status
        violation.payload = payload
        session.commit()
        session.refresh(violation)
        pr = session.get(PullRequest, violation.pull_request_id)
        repo_row = session.get(Repository, pr.repository_id) if pr else None
        rule = session.get(GovernanceRule, violation.rule_id)
        if pr is None or repo_row is None or rule is None:
            return None
        return _to_convention_finding(violation, pr, repo_row, rule)

    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type not in ANALYSIS_TYPES:
        return None
    payload = deepcopy(row.payload) if row.payload else {}
    payload["status"] = status
    row.payload = payload
    session.commit()
    session.refresh(row)
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


# Deprecated — kept for importers; trends removed from API.
def compute_trends(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
    return []
