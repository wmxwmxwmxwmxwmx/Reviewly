from __future__ import annotations

from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import GovernanceRule, GovernanceViolation
from app.mock import seed


def list_rules(session: Session) -> list[dict]:
    rows = session.scalars(select(GovernanceRule).where(GovernanceRule.enabled.is_(True))).all()
    if not rows:
        return seed.get_governance_rules()
    result = []
    for rule in rows:
        payload = deepcopy(rule.payload) if rule.payload else {"id": rule.id, "rule": rule.rule}
        violations = session.scalars(
            select(GovernanceViolation).where(
                GovernanceViolation.rule_id == rule.id,
                GovernanceViolation.violated.is_(True),
            )
        ).all()
        if violations:
            v = violations[0]
            payload["violated"] = True
            payload["file"] = v.file or payload.get("file")
        result.append(payload)
    return result


def list_violations(session: Session) -> list[dict]:
    rows = session.scalars(
        select(GovernanceViolation).where(GovernanceViolation.violated.is_(True))
    ).all()
    return [deepcopy(r.payload) if r.payload else {"id": r.id, "ruleId": r.rule_id} for r in rows]
