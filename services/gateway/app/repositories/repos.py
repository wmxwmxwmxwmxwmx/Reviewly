from __future__ import annotations

from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Repository


def list_repos(session: Session) -> list[dict]:
    rows = session.scalars(select(Repository).order_by(Repository.full_name)).all()
    return [deepcopy(r.payload) if r.payload else _repo_from_row(r) for r in rows]


def get_repo(session: Session, repo_id: str) -> Repository | None:
    return session.get(Repository, repo_id)


def upsert_repo(
    session: Session,
    *,
    repo_id: str,
    full_name: str,
    installation_id: str | None = None,
    payload: dict | None = None,
) -> Repository:
    row = session.get(Repository, repo_id)
    if row is None:
        row = Repository(
            id=repo_id,
            full_name=full_name,
            installation_id=installation_id,
            payload=payload,
        )
        session.add(row)
    else:
        row.full_name = full_name
        if installation_id is not None:
            row.installation_id = installation_id
        if payload is not None:
            row.payload = payload
    session.flush()
    return row


def _repo_from_row(row: Repository) -> dict:
    return {
        "id": row.id,
        "fullName": row.full_name,
        "defaultBranch": "main",
        "openPrCount": 0,
        "healthScore": 80,
        "aiReviewEnabled": row.ai_review_enabled,
    }
