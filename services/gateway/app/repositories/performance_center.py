"""Performance Center aggregation — filtered list + optimize context."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest, PullRequestDiff, Repository
from app.engine.rules import PERF_TYPE_LABELS
from app.mock import seed
from app.repositories.security_center import extract_file_context


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
    }


def _seed_performance_items() -> list[dict[str, Any]]:
    pr = seed.get_pull_request(seed.DEFAULT_PR_ID) or {}
    repo_name = str(pr.get("repo", "acme-corp/backend"))
    pr_number = int(pr.get("number", 0))
    pr_id = seed.DEFAULT_PR_ID
    items: list[dict[str, Any]] = []
    for f in seed.list_findings(seed.DEFAULT_PR_ID):
        if f.get("type") != "performance" and not f.get("perfType"):
            continue
        payload = deepcopy(f)
        perf_type = resolve_perf_type(payload, str(f.get("title", "")))
        items.append(
            {
                "id": str(f.get("id", "")),
                "file": f.get("file", ""),
                "line": int(f.get("line", 0)),
                "type": perf_type,
                "severity": f.get("severity", "medium"),
                "description": str(f.get("description", "")),
                "suggestion": str(f.get("fixSuggestion", "")),
                "repo": repo_name,
                "prNumber": pr_number,
                "pullRequestId": pr_id,
                "title": f.get("title", ""),
                "ruleId": payload.get("ruleId", ""),
            }
        )
    if not items:
        items = [
            {
                "id": "perf-seed-blocking",
                "file": "internal/gateway/client.go",
                "line": 88,
                "type": "Blocking IO",
                "severity": "medium",
                "description": "time.Sleep 出现在热路径。",
                "suggestion": "使用 context 超时或异步调度。",
                "repo": repo_name,
                "prNumber": pr_number,
                "pullRequestId": pr_id,
                "title": "同步 sleep 可能阻塞",
                "ruleId": "blocking-io",
            },
            {
                "id": "perf-seed-n1",
                "file": "internal/db/query_builder.go",
                "line": 120,
                "type": "N+1 Query",
                "severity": "high",
                "description": "循环内 Query。",
                "suggestion": "批量预取或 JOIN。",
                "repo": repo_name,
                "prNumber": pr_number,
                "pullRequestId": pr_id,
                "title": "潜在 N+1 查询",
                "ruleId": "n-plus-one-query",
            },
        ]
    return items


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

    count_stmt = select(func.count()).select_from(base.subquery())
    total = session.scalar(count_stmt) or 0

    if total == 0:
        seed_items = _apply_filters(
            _seed_performance_items(),
            severities=severities,
            perf_type=perf_type,
            repo=repo,
            q=q,
        )
        total = len(seed_items)
        start = (page - 1) * page_size
        return seed_items[start : start + page_size], total

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
