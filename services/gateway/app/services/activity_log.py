"""Record and query dashboard activity events."""
from __future__ import annotations

import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ActivityEvent


def _relative_time(created_at: datetime) -> str:
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    delta = now - created_at
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return "刚刚"
    if seconds < 3600:
        return f"{seconds // 60} 分钟前"
    if seconds < 86400:
        return f"{seconds // 3600} 小时前"
    return f"{seconds // 86400} 天前"


def _event_to_api(row: ActivityEvent) -> dict[str, Any]:
    return {
        "type": row.type,
        "user": row.actor,
        "action": row.action,
        "repo": row.repo,
        "time": _relative_time(row.created_at),
        "createdAt": row.created_at.isoformat().replace("+00:00", "Z"),
        "pullRequestId": row.pull_request_id,
        "payload": deepcopy(row.payload) if row.payload else None,
    }


def record_activity(
    session: Session,
    *,
    event_type: str,
    actor: str,
    action: str,
    repo: str,
    pull_request_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> ActivityEvent:
    row = ActivityEvent(
        id=f"act-{uuid.uuid4().hex[:12]}",
        type=event_type,
        actor=actor,
        action=action,
        repo=repo,
        pull_request_id=pull_request_id,
        payload=payload,
    )
    session.add(row)
    session.flush()
    return row


def list_recent(session: Session, limit: int = 20, *, connected_only: bool = False) -> list[dict[str, Any]]:
    rows = session.scalars(
        select(ActivityEvent).order_by(ActivityEvent.created_at.desc()).limit(limit * 3 if connected_only else limit)
    ).all()
    if connected_only:
        from app.db.models import Repository
        from app.repositories.seed_filter import external_repository_predicate, is_connected_repository

        external_rows = session.scalars(
            select(Repository.full_name).where(external_repository_predicate())
        ).all()
        external_names = {name for name in external_rows if name}
        rows = [r for r in rows if not r.repo or r.repo not in external_names]
        rows = rows[:limit]
    else:
        rows = rows[:limit]
    return [_event_to_api(r) for r in rows]
