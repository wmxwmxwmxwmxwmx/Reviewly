"""Security Center aggregation — filtered list + explain context."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest, PullRequestDiff, Repository
from app.mock import seed
from app.repositories.ai_persisted import extract_from_payload

RULE_LABELS: dict[str, str] = {
    "sql-injection": "SQL Injection",
    "rule-sql": "SQL Injection",
    "xss": "XSS",
    "hardcoded-secret": "Hardcoded Secret",
    "token-leak": "Token Leak",
    "dangerous-api": "Dangerous API",
    "command-injection": "Command Injection",
    "r1": "Race Condition",
    "r2": "SQL Injection",
    "r3": "Resource Leak",
}


def resolve_rule_label(payload: dict[str, Any], title: str = "") -> str:
    rule_id = str(payload.get("ruleId") or payload.get("id") or "")
    if rule_id in RULE_LABELS:
        return RULE_LABELS[rule_id]
    if payload.get("rule"):
        return str(payload["rule"])
    lower = title.lower()
    if "sql" in lower:
        return "SQL Injection"
    if "xss" in lower:
        return "XSS"
    if "secret" in lower or "密钥" in title:
        return "Hardcoded Secret"
    if "token" in lower:
        return "Token Leak"
    cwe = payload.get("cweId", "")
    if cwe == "CWE-89":
        return "SQL Injection"
    if cwe == "CWE-362":
        return "Race Condition"
    return "Security"


def _to_security_center_finding(
    row: AnalysisFinding,
    pr: PullRequest,
    repo: Repository,
) -> dict[str, Any]:
    payload = deepcopy(row.payload) if row.payload else {}
    pr_payload = pr.payload or {}
    repo_name = repo.full_name
    if not repo_name and pr_payload.get("repo"):
        repo_name = str(pr_payload["repo"])
    description = str(payload.get("description") or row.title or "")
    suggestion = str(
        payload.get("suggestion")
        or payload.get("fixSuggestion")
        or payload.get("fix_suggestion")
        or ""
    )
    return {
        "id": row.id,
        "repo": repo_name,
        "prNumber": pr.number,
        "pullRequestId": pr.id,
        "file": row.file,
        "line": row.line,
        "severity": row.severity,
        "rule": resolve_rule_label(payload, row.title),
        "description": description,
        "suggestion": suggestion,
        "status": payload.get("status", "open"),
        "title": row.title,
        "aiInsight": extract_from_payload(payload, "aiInsight"),
    }


def _seed_to_center_items() -> list[dict[str, Any]]:
    pr = seed.get_pull_request(seed.DEFAULT_PR_ID) or {}
    repo_name = str(pr.get("repo", "acme-corp/backend"))
    pr_number = int(pr.get("number", 0))
    pr_id = seed.DEFAULT_PR_ID
    items: list[dict[str, Any]] = []
    for f in seed.list_security_findings():
        payload = deepcopy(f)
        rule_id = str(payload.get("ruleId") or payload.get("id", ""))
        if rule_id == "r2":
            payload["ruleId"] = "sql-injection"
        elif rule_id == "r1":
            payload["ruleId"] = "r1"
        elif rule_id == "r3":
            payload["ruleId"] = "r3"
        items.append(
            {
                "id": str(f.get("id", "")),
                "repo": repo_name,
                "prNumber": pr_number,
                "pullRequestId": pr_id,
                "file": f.get("file", ""),
                "line": int(f.get("line", 0)),
                "severity": f.get("severity", "medium"),
                "rule": resolve_rule_label(payload, str(f.get("title", ""))),
                "description": str(f.get("description", "")),
                "suggestion": str(f.get("fixSuggestion", "")),
                "status": f.get("status", "open"),
                "title": f.get("title", ""),
            }
        )
    return items


def _apply_filters(
    items: list[dict[str, Any]],
    *,
    severities: list[str] | None,
    repo: str | None,
    q: str | None,
) -> list[dict[str, Any]]:
    out = items
    if severities:
        out = [i for i in out if i.get("severity") in severities]
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
            or needle in str(i.get("rule", "")).lower()
        ]
    return out


def list_security_findings_filtered(
    session: Session,
    *,
    severity: str | None = None,
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
        .where(AnalysisFinding.type == "security")
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

    count_stmt = select(func.count()).select_from(base.subquery())
    total = session.scalar(count_stmt) or 0

    if total == 0:
        return [], 0

    rows = session.execute(
        base.order_by(AnalysisFinding.severity, AnalysisFinding.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [_to_security_center_finding(f, pr, repo_row) for f, pr, repo_row in rows]
    return items, int(total)


def extract_file_context(files: list[dict], file_path: str, line: int, *, radius: int = 15) -> str:
    target = next((f for f in files if f.get("path") == file_path), None)
    if not target:
        return ""

    numbered: list[tuple[int, str]] = []
    for chunk in target.get("chunks", []):
        for entry in chunk.get("lines", []):
            ln = int(entry.get("line", 0) or entry.get("newLine", 0) or 0)
            content = str(entry.get("content", ""))
            prefix = "+" if entry.get("type") == "add" else "-" if entry.get("type") == "remove" else " "
            if ln:
                numbered.append((ln, f"{prefix}{content}"))
            else:
                numbered.append((len(numbered) + 1, f"{prefix}{content}"))

    if not numbered:
        return ""

    if line > 0:
        lo = max(1, line - radius)
        hi = line + radius
        slice_lines = [text for ln, text in numbered if lo <= ln <= hi]
    else:
        slice_lines = [text for _, text in numbered[: radius * 2]]

    return "\n".join(slice_lines)


def get_finding_with_context(session: Session, finding_id: str) -> dict[str, Any] | None:
    row = session.get(AnalysisFinding, finding_id)
    if row is None or row.type != "security":
        return None

    job = session.get(AnalysisJob, row.job_id)
    if job is None:
        return None

    pr = session.get(PullRequest, job.pull_request_id)
    repo_row = session.get(Repository, pr.repository_id) if pr else None
    if pr is None or repo_row is None:
        return None

    center = _to_security_center_finding(row, pr, repo_row)
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
