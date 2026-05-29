"""Performance Center aggregation — filtered list + optimize context."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest, PullRequestDiff, Repository
from app.engine.rules import PERF_TYPE_LABELS
from app.repositories.ai_persisted import extract_from_payload
from app.repositories.security_center import extract_file_context
from app.repositories.seed_filter import (
    exclude_seed_findings,
    is_seed_pull_request,
    is_seed_repository,
)


def resolve_perf_type(payload: dict[str, Any], title: str = "") -> str:
    if payload.get("perfType"):
        return str(payload["perfType"])
    rule_id = str(payload.get("ruleId") or payload.get("id") or "")
    if rule_id in PERF_TYPE_LABELS:
        return PERF_TYPE_LABELS[rule_id]
    raw = payload.get("type")
    if raw and raw not in ("performance", "security", "architecture", "maintainability"):
        return str(raw)
    lower = title.lower()
    if "n+1" in lower or "n+1" in lower.replace(" ", ""):
        return "N+1 Query"
    if "sleep" in lower or "blocking" in lower:
        return "Blocking IO"
    if "loop" in lower:
        return "High Complexity Loop"
    return "Performance"


def _to_performance_center_finding(
    row: AnalysisFinding,
    pr: PullRequest,
    repo: Repository,
) -> dict[str, Any]:
    payload = deepcopy(row.payload) if row.payload else {}
    pr_payload = pr.payload or {}
    repo_name = repo.full_name
    if not repo_name and pr_payload.get("repo"):
        repo_name = str(pr_payload["repo"])
    perf_type = resolve_perf_type(payload, row.title)
    description = str(payload.get("description") or row.title or "")
    suggestion = str(
        payload.get("suggestion")
        or payload.get("fixSuggestion")
        or payload.get("fix_suggestion")
        or ""
    )
    return {
        "id": row.id,
        "file": row.file,
        "line": row.line,
        "type": perf_type,
        "severity": row.severity,
        "description": description,
        "suggestion": suggestion,
        "repo": repo_name,
        "prNumber": pr.number,
        "pullRequestId": pr.id,
        "title": row.title,
        "ruleId": payload.get("ruleId", ""),
        "aiOptimization": extract_from_payload(payload, "aiOptimization"),
    }


def _apply_filters(
    items: list[dict[str, Any]],
    *,
    severities: list[str] | None,
    perf_type: str | None,
    repo: str | None,
    q: str | None,
) -> list[dict[str, Any]]:
    out = items
    if severities:
        out = [i for i in out if i.get("severity") in severities]
    if perf_type:
        needle = perf_type.lower()
        out = [i for i in out if needle in str(i.get("type", "")).lower()]
    if repo:
        out = [i for i in out if repo.lower() in str(i.get("repo", "")).lower()]
    if q:
        needle = q.lower()
        out = [
            i
            for i in out
            if needle in str(i.get("title", "")).lower()
            or needle in str(i.get("description", "")).lower()
            or needle in str(i.get("file", "")).lower()
            or needle in str(i.get("type", "")).lower()
        ]
    return out


def list_performance_findings_filtered(
    session: Session,
    *,
    severity: str | None = None,
    perf_type: str | None = None,
    repo: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict[str, Any]], int]:
    severities = [s.strip() for s in severity.split(",") if s.strip()] if severity else None

    base = (
        select(AnalysisFinding, PullRequest, Repository)
        .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
        .join(PullRequest, AnalysisJob.pull_request_id == PullRequest.id)
        .join(Repository, PullRequest.repository_id == Repository.id)
        .where(AnalysisFinding.type == "performance")
    )

    if severities:
        base = base.where(AnalysisFinding.severity.in_(severities))
    if repo:
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
    if perf_type:
        base = base.where(cast(AnalysisFinding.payload, String).ilike(f"%{perf_type}%"))

    base = exclude_seed_findings(base)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = session.scalar(count_stmt) or 0

    if total == 0:
        return [], 0

    rows = session.execute(
        base.order_by(AnalysisFinding.severity, AnalysisFinding.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [_to_performance_center_finding(f, pr, repo_row) for f, pr, repo_row in rows]
    return items, int(total)


def get_finding_with_context(session: Session, finding_id: str) -> dict[str, Any] | None:
    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type != "performance":
        return None

    job = session.get(AnalysisJob, row.job_id)
    if job is None:
        return None

    pr = session.get(PullRequest, job.pull_request_id)
    repo_row = session.get(Repository, pr.repository_id) if pr else None
    if pr is None or repo_row is None:
        return None
    if is_seed_repository(repo_row) or is_seed_pull_request(pr, repo=repo_row):
        return None

    center = _to_performance_center_finding(row, pr, repo_row)
    diff_row = session.get(PullRequestDiff, pr.id)
    files = deepcopy(diff_row.files) if diff_row and diff_row.files else []
    patch = diff_row.patch if diff_row else ""
    context = extract_file_context(files, row.file, row.line)
    payload = row.payload or {}

    return {
        **center,
        "finding": deepcopy(payload) if payload else center,
        "patchExcerpt": patch[:4000] if patch else "",
        "codeContext": context,
    }
