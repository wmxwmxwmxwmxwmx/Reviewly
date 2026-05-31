from __future__ import annotations

import json
import uuid
from copy import deepcopy
from typing import Any

from sqlalchemy import inspect as sa_inspect, not_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

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


def _payload_from_row(raw: Any) -> dict[str, Any]:
    """Normalize governance_rules.payload from JSONB / legacy corrupt values."""
    if raw is None:
        return {}
    if isinstance(raw, (bytes, bytearray, memoryview)):
        try:
            raw = json.loads(bytes(raw).decode("utf-8", errors="replace"))
        except json.JSONDecodeError:
            return {}
    elif isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return {}
    if not isinstance(raw, dict):
        return {}
    return _json_safe(deepcopy(raw))


def _apply_definition_to_row(row: GovernanceRule, definition: dict[str, Any]) -> None:
    """Write a JSON-safe definition back to ORM columns + JSONB payload."""
    safe = _json_safe(definition)
    row.rule = _coerce_text(safe.get("rule", row.rule))
    row.severity = _coerce_text(safe.get("severity", row.severity))
    row.enabled = bool(safe.get("enabled", row.enabled))
    row.payload = _json_safe({k: v for k, v in safe.items() if k != "id"})
    flag_modified(row, "payload")


def _row_to_definition(row: GovernanceRule) -> dict[str, Any]:
    payload = _payload_from_row(row.payload)
    payload["id"] = row.id
    payload["rule"] = _coerce_text(row.rule)
    payload["severity"] = _coerce_text(row.severity)
    payload["enabled"] = row.enabled
    payload.setdefault("matchType", payload.get("matchType", "keyword"))
    payload.setdefault("keywords", payload.get("keywords", []))
    payload.setdefault("filePatterns", payload.get("filePatterns", []))
    payload.setdefault("findingTypes", payload.get("findingTypes", []))
    payload.setdefault("findingSeverities", payload.get("findingSeverities", []))
    return _json_safe(payload)


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


def _repair_row_payload_if_needed(session: Session, row: GovernanceRule) -> bool:
    """Persist sanitized payload when legacy rows contain non-JSON-safe values."""
    definition = _row_to_definition(row)
    clean_stored = _json_safe({k: v for k, v in definition.items() if k != "id"})
    current_stored = _json_safe(row.payload or {})
    needs_repair = (
        clean_stored != current_stored
        or _coerce_text(row.rule) != row.rule
        or _coerce_text(row.severity) != row.severity
    )
    if not needs_repair:
        return False
    _apply_definition_to_row(row, definition)
    return True


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
    repaired = False
    for row in rows:
        if _repair_row_payload_if_needed(session, row):
            repaired = True
    if repaired:
        try:
            session.commit()
        except Exception:
            session.rollback()
            raise
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
    try:
        session.commit()
        session.refresh(row)
    except Exception:
        session.rollback()
        raise
    return _row_to_definition(row)


def _pick_field(payload: dict[str, Any], camel: str, snake: str, default: Any = None) -> Any:
    if camel in payload:
        return payload[camel]
    if snake in payload:
        return payload[snake]
    return default


def _coerce_text(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace").strip()
    if isinstance(value, bytearray):
        return bytes(value).decode("utf-8", errors="replace").strip()
    if isinstance(value, memoryview):
        return bytes(value).decode("utf-8", errors="replace").strip()
    return str(value).strip()


def _json_safe(value: Any) -> Any:
    """Recursively coerce values so JSON/JSONB persistence never sees bytes."""
    if isinstance(value, (bytes, bytearray, memoryview)):
        return _coerce_text(value)
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [_json_safe(v) for v in value]
    return value


def _normalize_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [x.strip() for x in value.split(",") if x.strip()]
    if isinstance(value, list):
        return [text for x in value if (text := _coerce_text(x))]
    return []


def _resolved_enabled(payload: dict[str, Any], *, default: bool = True) -> bool:
    if "enabled" in payload:
        return bool(payload["enabled"])
    return default


def _is_enabled_only_patch(body: dict[str, Any]) -> bool:
    return set(body.keys()) == {"enabled"}


def set_rule_enabled(session: Session, rule_id: str, enabled: bool) -> dict | None:
    """Toggle rule on/off without re-normalizing the full rule body."""
    ensure_governance_schema(session)
    row = session.get(GovernanceRule, rule_id)
    if row is None:
        return None
    _repair_row_payload_if_needed(session, row)
    definition = _row_to_definition(row)
    definition["enabled"] = enabled
    _apply_definition_to_row(row, definition)
    try:
        session.commit()
        session.refresh(row)
    except Exception:
        session.rollback()
        raise
    return _row_to_definition(row)


def _normalize_rule_body(body: dict[str, Any]) -> dict[str, Any]:
    payload = _json_safe(deepcopy(body))
    rule_text = _coerce_text(payload.get("rule", ""))
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
        "enabled": _resolved_enabled(payload),
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
        normalized["description"] = _coerce_text(description)
    return _json_safe(normalized)


def update_rule(session: Session, rule_id: str, body: dict[str, Any]) -> dict | None:
    ensure_governance_schema(session)
    row = session.get(GovernanceRule, rule_id)
    if row is None:
        return None

    if _is_enabled_only_patch(body):
        return set_rule_enabled(session, rule_id, _resolved_enabled(body))

    current = _row_to_definition(row)
    current.update(_json_safe(body))
    definition = _normalize_rule_body(current)
    definition["id"] = row.id
    _apply_definition_to_row(row, definition)
    try:
        session.commit()
        session.refresh(row)
    except Exception:
        session.rollback()
        raise
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
