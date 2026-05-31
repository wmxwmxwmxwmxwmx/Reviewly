from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any

from sqlalchemy import inspect as sa_inspect, not_, select
from sqlalchemy.orm import Session

from app.db.models import AuditLog, GovernanceRule, GovernanceViolation, PullRequest, Repository
from app.repositories.seed_filter import (
    only_stats_eligible_repositories,
    seed_governance_rule_predicate,
    seed_pull_request_predicate,
)


def ensure_governance_schema(session: Session) -> None:
    """Create governance tables when Alembic version is ahead of actual schema."""
    bind = session.get_bind()
    inspector = sa_inspect(bind)
    if inspector.has_table("governance_rules") and inspector.has_table("governance_violations"):
        return
    GovernanceRule.metadata.create_all(
        bind=bind,
        tables=[GovernanceRule.__table__, GovernanceViolation.__table__],
    )


def _row_to_definition(row: GovernanceRule) -> dict[str, Any]:
    payload = deepcopy(row.payload) if row.payload else {}
    payload["id"] = row.id
    payload["rule"] = row.rule
    payload["severity"] = row.severity
    payload["enabled"] = row.enabled
    payload.setdefault("matchType", payload.get("matchType", "keyword"))
    payload.setdefault("keywords", payload.get("keywords", []))
    payload.setdefault("filePatterns", payload.get("filePatterns", []))
    payload.setdefault("findingTypes", payload.get("findingTypes", []))
    payload.setdefault("findingSeverities", payload.get("findingSeverities", []))
    return payload


def ensure_builtin_rules(session: Session) -> None:
    """Seed default governance rules when the table is empty."""
    existing = session.scalar(select(GovernanceRule.id).limit(1))
    if existing:
        return
    builtins = [
        {
            "id": "gov-forbidden-secrets",
            "rule": "禁止在代码中提交密钥或 Token",
            "severity": "critical",
            "matchType": "keyword",
            "keywords": ["api_key", "secret", "password", "private_key", "BEGIN RSA"],
        },
        {
            "id": "gov-forbidden-paths",
            "rule": "禁止修改生产部署与凭证路径",
            "severity": "high",
            "matchType": "file_pattern",
            "filePatterns": ["**/.env*", "**/secrets/**", "**/deploy/prod/**"],
        },
        {
            "id": "gov-missing-tests",
            "rule": "业务代码变更应包含测试文件",
            "severity": "medium",
            "matchType": "missing_tests",
        },
        {
            "id": "gov-large-pr",
            "rule": "超大 PR 需要拆分审查",
            "severity": "medium",
            "matchType": "large_pr",
            "maxLines": 800,
            "maxFiles": 40,
        },
    ]
    for spec in builtins:
        session.add(
            GovernanceRule(
                id=spec["id"],
                rule=spec["rule"],
                severity=spec["severity"],
                enabled=True,
                payload=spec,
            )
        )
    session.flush()


def list_enabled_rule_definitions(session: Session) -> list[dict[str, Any]]:
    ensure_builtin_rules(session)
    rows = session.scalars(
        select(GovernanceRule)
        .where(GovernanceRule.enabled.is_(True))
        .where(not_(seed_governance_rule_predicate()))
    ).all()
    if not rows:
        return []
    return [_row_to_definition(r) for r in rows]


def list_rule_definitions(
    session: Session,
    *,
    include_disabled: bool = False,
) -> list[dict[str, Any]]:
    ensure_governance_schema(session)
    query = select(GovernanceRule).where(not_(seed_governance_rule_predicate()))
    if not include_disabled:
        query = query.where(GovernanceRule.enabled.is_(True))
    rows = session.scalars(query).all()
    if not rows:
        return []
    return [_row_to_definition(r) for r in rows]


def list_rules(session: Session) -> list[dict]:
    return list_rule_definitions(session, include_disabled=False)


def get_rule(session: Session, rule_id: str) -> dict | None:
    ensure_governance_schema(session)
    row = session.get(GovernanceRule, rule_id)
    if row is None:
        return None
    return _row_to_definition(row)


def create_rule(session: Session, body: dict[str, Any]) -> dict:
    ensure_governance_schema(session)
    rid = body.get("id") or f"g-{uuid.uuid4().hex[:8]}"
    payload = _normalize_rule_body(body)
    row = GovernanceRule(
        id=rid,
        rule=payload["rule"],
        severity=payload.get("severity", "medium"),
        enabled=bool(payload.get("enabled", True)),
        payload=payload,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _row_to_definition(row)


def _pick_field(payload: dict[str, Any], camel: str, snake: str, default: Any = None) -> Any:
    if camel in payload:
        return payload[camel]
    if snake in payload:
        return payload[snake]
    return default


def _normalize_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [x.strip() for x in value.split(",") if x.strip()]
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    return []


def _normalize_rule_body(body: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(body)
    rule_text = str(payload.get("rule", "")).strip()
    if not rule_text:
        raise ValueError("规则描述不能为空")
    severity = str(payload.get("severity", "medium")).lower()
    if severity not in ("critical", "high", "medium", "low"):
        severity = "medium"
    match_type = str(_pick_field(payload, "matchType", "match_type", "keyword")).lower()
    if match_type not in (
        "keyword",
        "file_pattern",
        "finding",
        "any",
        "missing_tests",
        "large_pr",
    ):
        match_type = "keyword"
    description = _pick_field(payload, "description", "description")
    normalized: dict[str, Any] = {
        "rule": rule_text,
        "severity": severity,
        "enabled": bool(payload.get("enabled", True)),
        "matchType": match_type,
        "keywords": _normalize_string_list(payload.get("keywords")),
        "filePatterns": _normalize_string_list(
            _pick_field(payload, "filePatterns", "file_patterns"),
        ),
        "findingTypes": _normalize_string_list(
            _pick_field(payload, "findingTypes", "finding_types"),
        ),
        "findingSeverities": _normalize_string_list(
            _pick_field(payload, "findingSeverities", "finding_severities"),
        ),
    }
    if description is not None:
        normalized["description"] = str(description).strip()
    return normalized


def update_rule(session: Session, rule_id: str, body: dict[str, Any]) -> dict | None:
    ensure_governance_schema(session)
    row = session.get(GovernanceRule, rule_id)
    if row is None:
        return None
    current = _row_to_definition(row)
    current.update(body)
    payload = _normalize_rule_body(current)
    row.rule = payload["rule"]
    row.severity = payload["severity"]
    row.enabled = payload["enabled"]
    row.payload = payload
    session.commit()
    session.refresh(row)
    return _row_to_definition(row)


def delete_rule(session: Session, rule_id: str) -> bool:
    ensure_governance_schema(session)
    row = session.get(GovernanceRule, rule_id)
    if row is None:
        return False
    session.execute(
        GovernanceViolation.__table__.delete().where(GovernanceViolation.rule_id == rule_id)
    )
    session.delete(row)
    session.commit()
    return True


def list_rules_for_pr(session: Session, pr_id: str) -> list[dict]:
    """All enabled rules with per-PR evaluation results (violations table)."""
    rules = list_enabled_rule_definitions(session)
    violations = session.scalars(
        select(GovernanceViolation).where(GovernanceViolation.pull_request_id == pr_id)
    ).all()
    by_rule = {v.rule_id: v for v in violations}

    result: list[dict] = []
    for rule in rules:
        payload = deepcopy(rule)
        violation = by_rule.get(rule["id"])
        if violation:
            payload["violated"] = bool(violation.violated)
            payload["file"] = violation.file
            vpayload = violation.payload or {}
            payload["feedback"] = vpayload.get("feedback")
            payload["evidence"] = vpayload.get("evidence", [])
            payload["evaluatedAt"] = vpayload.get("evaluatedAt")
        else:
            payload["violated"] = False
            payload["file"] = None
            payload["feedback"] = None
            payload["evidence"] = []
        result.append(payload)
    return result


def list_violations(session: Session) -> list[dict]:
    rows = session.scalars(
        only_stats_eligible_repositories(
            select(GovernanceViolation)
            .join(PullRequest, GovernanceViolation.pull_request_id == PullRequest.id)
            .join(Repository, PullRequest.repository_id == Repository.id)
            .where(GovernanceViolation.violated.is_(True))
            .where(not_(seed_pull_request_predicate()))
        )
    ).all()
    if rows:
        out: list[dict] = []
        for r in rows:
            item = deepcopy(r.payload) if r.payload else {}
            item["id"] = r.id
            item["ruleId"] = r.rule_id
            item["pullRequestId"] = r.pull_request_id
            item["file"] = r.file
            out.append(item)
        return out
    return []


def list_audit_logs(session: Session, limit: int = 50) -> list[dict]:
    rows = session.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return [
        deepcopy(r.payload)
        if r.payload
        else {"id": r.id, "action": r.action, "actorId": r.actor_id}
        for r in rows
    ]


def create_audit_log(session: Session, body: dict[str, Any]) -> dict:
    aid = body.get("id") or f"audit-{uuid.uuid4().hex[:8]}"
    row = AuditLog(
        id=aid,
        action=body.get("action", "unknown"),
        actor_id=body.get("actorId"),
        payload=deepcopy(body),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return deepcopy(row.payload) if row.payload else {"id": row.id, "action": row.action}
