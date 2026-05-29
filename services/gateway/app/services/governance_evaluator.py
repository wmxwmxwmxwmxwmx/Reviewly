"""Evaluate governance rules against PR diff and analysis findings."""
from __future__ import annotations

import fnmatch
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.models import GovernanceViolation
from app.repositories import governance as governance_repo


@dataclass
class RuleEvaluation:
    rule_id: str
    violated: bool
    file: str | None
    feedback: str | None
    evidence: list[str]


def _rule_config(rule: dict[str, Any]) -> dict[str, Any]:
    return rule if "matchType" in rule else {**rule, "matchType": _infer_match_type(rule)}


def _infer_match_type(rule: dict[str, Any]) -> str:
    if rule.get("findingTypes") or rule.get("findingSeverities"):
        return "finding"
    if rule.get("filePatterns"):
        return "file_pattern"
    if rule.get("keywords"):
        return "keyword"
    return "keyword"


def _normalize_keywords(rule: dict[str, Any]) -> list[str]:
    raw = rule.get("keywords") or []
    if isinstance(raw, str):
        raw = [k.strip() for k in raw.split(",") if k.strip()]
    return [k.lower() for k in raw if isinstance(k, str) and k.strip()]


def _normalize_patterns(rule: dict[str, Any]) -> list[str]:
    raw = rule.get("filePatterns") or []
    if isinstance(raw, str):
        raw = [p.strip() for p in raw.split(",") if p.strip()]
    return [p for p in raw if isinstance(p, str) and p.strip()]


def _match_file_pattern(pattern: str, path: str) -> bool:
    normalized = path.replace("\\", "/")
    return fnmatch.fnmatch(normalized, pattern) or fnmatch.fnmatch(
        normalized, pattern.removeprefix("**/") if pattern.startswith("**/") else pattern
    )


def _search_keywords(text: str, keywords: list[str]) -> list[str]:
    haystack = text.lower()
    return [kw for kw in keywords if kw in haystack]


def _evaluate_keyword(
    rule: dict[str, Any],
    *,
    patch: str,
    file_paths: list[str],
    findings: list[dict[str, Any]],
) -> RuleEvaluation:
    keywords = _normalize_keywords(rule)
    if not keywords:
        return RuleEvaluation(rule["id"], False, None, None, [])

    diff_hits = _search_keywords(patch, keywords)
    if diff_hits:
        first_file = file_paths[0] if file_paths else None
        kw = diff_hits[0]
        return RuleEvaluation(
            rule["id"],
            True,
            first_file,
            f"Diff 中检测到关键词「{kw}」，与规则「{rule['rule']}」冲突。",
            [f"keyword:{kw}"],
        )

    for finding in findings:
        blob = " ".join(
            str(finding.get(k, ""))
            for k in ("title", "description", "file", "fixSuggestion", "rootCause")
        )
        hits = _search_keywords(blob, keywords)
        if hits:
            kw = hits[0]
            loc = f"{finding.get('file', '?')}:{finding.get('line', '?')}"
            return RuleEvaluation(
                rule["id"],
                True,
                str(finding.get("file") or loc),
                f"在 {loc} 的分析结果中发现「{kw}」，违反「{rule['rule']}」。",
                [f"finding:{finding.get('id', '')}", f"keyword:{kw}"],
            )

    return RuleEvaluation(
        rule["id"],
        False,
        None,
        f"未在变更或 findings 中匹配到关键词 {keywords}，规则通过。",
        [],
    )


def _evaluate_file_pattern(
    rule: dict[str, Any],
    *,
    file_paths: list[str],
) -> RuleEvaluation:
    patterns = _normalize_patterns(rule)
    if not patterns:
        return RuleEvaluation(rule["id"], False, None, None, [])

    for path in file_paths:
        for pattern in patterns:
            if _match_file_pattern(pattern, path):
                return RuleEvaluation(
                    rule["id"],
                    True,
                    path,
                    f"变更文件 {path} 命中路径规则「{pattern}」（{rule['rule']}）。",
                    [f"file:{path}", f"pattern:{pattern}"],
                )

    return RuleEvaluation(
        rule["id"],
        False,
        None,
        "变更文件未命中配置的路径模式，规则通过。",
        [],
    )


def _evaluate_finding(
    rule: dict[str, Any],
    *,
    findings: list[dict[str, Any]],
) -> RuleEvaluation:
    types = {t.lower() for t in (rule.get("findingTypes") or []) if isinstance(t, str)}
    severities = {s.lower() for s in (rule.get("findingSeverities") or []) if isinstance(s, str)}

    matched: list[dict[str, Any]] = []
    for finding in findings:
        ftype = str(finding.get("type", "")).lower()
        sev = str(finding.get("severity", "")).lower()
        if types and ftype not in types:
            continue
        if severities and sev not in severities:
            continue
        if not types and not severities:
            continue
        matched.append(finding)

    if matched:
        top = matched[0]
        loc = f"{top.get('file', '?')}:{top.get('line', '?')}"
        return RuleEvaluation(
            rule["id"],
            True,
            str(top.get("file") or loc),
            f"发现 {len(matched)} 条匹配的扫描项（示例 {loc}：{top.get('title', '')}），违反「{rule['rule']}」。",
            [f"finding:{f.get('id', '')}" for f in matched[:5]],
        )

    return RuleEvaluation(
        rule["id"],
        False,
        None,
        "未发现符合类型/严重级别的 findings，规则通过。",
        [],
    )


def _evaluate_any(
    rule: dict[str, Any],
    *,
    patch: str,
    file_paths: list[str],
    findings: list[dict[str, Any]],
) -> RuleEvaluation:
    subtypes = ("keyword", "file_pattern", "finding")
    evidence: list[str] = []
    for subtype in subtypes:
        sub_rule = {**rule, "matchType": subtype}
        result = evaluate_rule(
            sub_rule,
            patch=patch,
            file_paths=file_paths,
            findings=findings,
        )
        if result.violated:
            evidence.extend(result.evidence)
            return RuleEvaluation(
                rule["id"],
                True,
                result.file,
                result.feedback,
                evidence,
            )
    return RuleEvaluation(
        rule["id"],
        False,
        None,
        "未触发关键词、路径或 findings 任一匹配条件，规则通过。",
        [],
    )


def evaluate_rule(
    rule: dict[str, Any],
    *,
    patch: str,
    file_paths: list[str],
    findings: list[dict[str, Any]],
) -> RuleEvaluation:
    cfg = _rule_config(rule)
    match_type = str(cfg.get("matchType", "keyword")).lower()

    if match_type == "file_pattern":
        return _evaluate_file_pattern(cfg, file_paths=file_paths)
    if match_type == "finding":
        return _evaluate_finding(cfg, findings=findings)
    if match_type == "any":
        return _evaluate_any(cfg, patch=patch, file_paths=file_paths, findings=findings)
    return _evaluate_keyword(cfg, patch=patch, file_paths=file_paths, findings=findings)


def evaluate_pr(
    session: Session,
    pull_request_id: str,
    *,
    patch: str,
    file_paths: list[str],
    findings: list[dict[str, Any]],
) -> list[RuleEvaluation]:
    rules = governance_repo.list_enabled_rule_definitions(session)
    return [
        evaluate_rule(
            rule,
            patch=patch,
            file_paths=file_paths,
            findings=findings,
        )
        for rule in rules
    ]


def persist_evaluations(
    session: Session,
    pull_request_id: str,
    evaluations: list[RuleEvaluation],
) -> None:
    session.execute(
        delete(GovernanceViolation).where(GovernanceViolation.pull_request_id == pull_request_id)
    )
    now = datetime.now(UTC).isoformat()
    for ev in evaluations:
        session.add(
            GovernanceViolation(
                id=f"gv-{uuid.uuid4().hex[:10]}",
                rule_id=ev.rule_id,
                pull_request_id=pull_request_id,
                file=ev.file,
                violated=ev.violated,
                payload={
                    "feedback": ev.feedback,
                    "evidence": ev.evidence,
                    "evaluatedAt": now,
                },
            )
        )
    session.flush()


def run_governance_check(
    session: Session,
    pull_request_id: str,
    *,
    patch: str,
    file_paths: list[str],
    findings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    evaluations = evaluate_pr(
        session,
        pull_request_id,
        patch=patch,
        file_paths=file_paths,
        findings=findings,
    )
    persist_evaluations(session, pull_request_id, evaluations)
    return governance_repo.list_rules_for_pr(session, pull_request_id)
