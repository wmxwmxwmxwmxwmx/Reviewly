from __future__ import annotations

import uuid
from copy import deepcopy
from typing import Any

from sqlalchemy import not_, select
from sqlalchemy.orm import Session

from app.db.models import User
from app.repositories.seed_filter import is_seed_user, seed_user_predicate
def _member_dict(row: User) -> dict:
    if row.payload:
        return deepcopy(row.payload)
    return {
        "id": row.id,
        "name": row.email.split("@")[0],
        "role": "Engineer",
        "reviewsThisWeek": 0,
        "avgReviewTimeHours": 0,
        "riskFindings": 0,
    }


def list_members(session: Session) -> list[dict]:
    rows = session.scalars(select(User).where(not_(seed_user_predicate()))).all()
    return [_member_dict(r) for r in rows]


def get_member(session: Session, member_id: str) -> dict | None:
    row = session.get(User, member_id)
    if row is None or is_seed_user(row):
        return None
    return _member_dict(row)


def create_member(session: Session, body: dict[str, Any]) -> dict:
    mid = body.get("id") or f"u-{uuid.uuid4().hex[:8]}"
    row = User(
        id=mid,
        team_id=body.get("teamId", "team-default"),
        email=body.get("email", f"{mid}@local"),
        payload=deepcopy(body),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _member_dict(row)


def update_member(session: Session, member_id: str, body: dict[str, Any]) -> dict | None:
    row = session.get(User, member_id)
    if row is None:
        return None
    if "email" in body:
        row.email = body["email"]
    payload = deepcopy(row.payload) if row.payload else _member_dict(row)
    payload.update(body)
    row.payload = payload
    session.commit()
    session.refresh(row)
    return _member_dict(row)


def delete_member(session: Session, member_id: str) -> bool:
    row = session.get(User, member_id)
    if row is None:
        return False
    session.delete(row)
    session.commit()
    return True
