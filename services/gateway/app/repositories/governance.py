from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditLog, GovernanceRule, GovernanceViolation
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


def list_enabled_rule_definitions(session: Session) -> list[dict[str, Any]]:
    rows = session.scalars(
        select(GovernanceRule).where(GovernanceRule.enabled.is_(True))
    ).all()
    if not rows:
        return []
    return [_row_to_definition(r) for r in rows]


def list_rule_definitions(
    session: Session,
    *,
    include_disabled: bool = False,
) -> list[dict[str, Any]]:
    query = select(GovernanceRule)
    if not include_disabled:
        query = query.where(GovernanceRule.enabled.is_(True))
    rows = session.scalars(query).all()
    if not rows:
        return []
    return [_row_to_definition(r) for r in rows]


def list_rules(session: Session) -> list[dict]:
    return list_rule_definitions(session, include_disabled=False)


def get_rule(session: Session, rule_id: str) -> dict | None:
    row = session.get(GovernanceRule, rule_id)
    if row is None:
        return None
    return _row_to_definition(row)


def create_rule(session: Session, body: dict[str, Any]) -> dict:
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


def _normalize_rule_body(body: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(body)
    rule_text = str(payload.get("rule", "")).strip()
    if not rule_text:
        raise ValueError("规则描述不能为空")
    payload["rule"] = rule_text
    severity = str(payload.get("severity", "medium")).lower()
    if severity not in ("critical", "high", "medium", "low"):
        severity = "medium"
    payload["severity"] = severity
    payload["enabled"] = bool(payload.get("enabled", True))
    match_type = str(payload.get("matchType", "keyword")).lower()
    if match_type not in ("keyword", "file_pattern", "finding", "any"):
        match_type = "keyword"
    payload["matchType"] = match_type
    for key in ("keywords", "filePatterns", "findingTypes", "findingSeverities"):
        if key not in payload:
            payload[key] = []
        elif isinstance(payload[key], str):
            payload[key] = [x.strip() for x in payload[key].split(",") if x.strip()]
    if payload.get("description") is not None:
        payload["description"] = str(payload["description"]).strip()
    return payload


def update_rule(session: Session, rule_id: str, body: dict[str, Any]) -> dict | None:
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
        select(GovernanceViolation).where(GovernanceViolation.violated.is_(True))
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
