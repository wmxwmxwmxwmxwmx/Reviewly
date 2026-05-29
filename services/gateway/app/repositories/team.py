from __future__ import annotations

from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import User
from app.mock import seed


def list_members(session: Session) -> list[dict]:
    rows = session.scalars(select(User)).all()
    if rows:
        return [deepcopy(r.payload) if r.payload else {"id": r.id, "email": r.email} for r in rows]
    return seed.get_team_members()
