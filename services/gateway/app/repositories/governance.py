from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditLog, GovernanceRule, GovernanceViolation
from app.mock import seed


def _rule_payload(rule: GovernanceRule, session: Session) -> dict:
    payload = deepcopy(rule.payload) if rule.payload else {"rule": rule.rule}
    payload["id"] = rule.id
    payload.setdefault("rule", rule.rule)
    payload.setdefault("severity", rule.severity)
    payload.setdefault("violated", False)
    violations = session.scalars(
        select(GovernanceViolation).where(
            GovernanceViolation.rule_id == rule.id,
            GovernanceViolation.violated.is_(True),
        )
    ).all()
    if violations:
        payload["violated"] = True
        payload["file"] = violations[0].file or payload.get("file")
    return payload


def list_rules(session: Session) -> list[dict]:
    rows = session.scalars(select(GovernanceRule).where(GovernanceRule.enabled.is_(True))).all()
    if not rows:
        return seed.get_governance_rules()
    return [_rule_payload(r, session) for r in rows]


def get_rule(session: Session, rule_id: str) -> dict | None:
    row = session.get(GovernanceRule, rule_id)
    if row is None:
        return None
    return _rule_payload(row, session)


def create_rule(session: Session, body: dict[str, Any]) -> dict:
    rid = body.get("id") or f"g-{uuid.uuid4().hex[:8]}"
    row = GovernanceRule(
        id=rid,
        rule=body.get("rule", ""),
        severity=body.get("severity", "medium"),
        enabled=body.get("enabled", True),
        payload=deepcopy(body),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _rule_payload(row, session)


def update_rule(session: Session, rule_id: str, body: dict[str, Any]) -> dict | None:
    row = session.get(GovernanceRule, rule_id)
    if row is None:
        return None
    if "rule" in body:
        row.rule = body["rule"]
    if "severity" in body:
        row.severity = body["severity"]
    if "enabled" in body:
        row.enabled = bool(body["enabled"])
    payload = deepcopy(row.payload) if row.payload else {}
    payload.update(body)
    row.payload = payload
    session.commit()
    session.refresh(row)
    return _rule_payload(row, session)


def delete_rule(session: Session, rule_id: str) -> bool:
    row = session.get(GovernanceRule, rule_id)
    if row is None:
        return False
    session.delete(row)
    session.commit()
    return True


def list_violations(session: Session) -> list[dict]:
    rows = session.scalars(
        select(GovernanceViolation).where(GovernanceViolation.violated.is_(True))
    ).all()
    if rows:
        return [deepcopy(r.payload) if r.payload else {"id": r.id, "ruleId": r.rule_id} for r in rows]
    return [r for r in seed.get_governance_rules() if r.get("violated")]


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
