"""DB-driven PR attention (unread / needs revisit) per user."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import PullRequest, PullRequestUserView


def _ensure_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def compute_attention_fields(
    pr_row: PullRequest,
    view: PullRequestUserView | None,
) -> dict[str, bool | str]:
    seen_at = _ensure_aware(view.last_seen_at) if view else None
    updated_at = _ensure_aware(pr_row.updated_at) or datetime.now(timezone.utc)
    head_sha = pr_row.head_sha
    seen_head = view.last_seen_head_sha if view else None

    if seen_at is None:
        is_unread = True
        needs_revisit = False
    else:
        is_unread = seen_at < updated_at
        head_changed = bool(head_sha and seen_head and head_sha != seen_head)
        needs_revisit = head_changed or seen_at < updated_at

    if is_unread:
        state = "unread"
    elif needs_revisit:
        state = "needs_revisit"
    else:
        state = "reviewed"

    return {
        "isUnread": is_unread,
        "needsRevisit": needs_revisit,
        "attentionState": state,
    }


def load_views_for_user(
    session: Session,
    user_id: str,
    pr_ids: list[str],
) -> dict[str, PullRequestUserView]:
    if not pr_ids:
        return {}
    rows = session.scalars(
        select(PullRequestUserView).where(
            PullRequestUserView.user_id == user_id,
            PullRequestUserView.pr_id.in_(pr_ids),
        )
    ).all()
    return {row.pr_id: row for row in rows}


def mark_pull_request_seen(
    session: Session,
    user_id: str,
    pr_id: str,
    *,
    head_sha: str | None,
) -> PullRequestUserView:
    row = session.get(
        PullRequestUserView,
        {"user_id": user_id, "pr_id": pr_id},
    )
    now = datetime.now(timezone.utc)
    if row is None:
        row = PullRequestUserView(
            user_id=user_id,
            pr_id=pr_id,
            last_seen_at=now,
            last_seen_head_sha=head_sha,
        )
        session.add(row)
    else:
        row.last_seen_at = now
        row.last_seen_head_sha = head_sha
    session.flush()
    return row


def filter_items_by_attention(
    items: list[dict],
    attention: str | None,
) -> list[dict]:
    if not attention or attention == "all":
        return items
    if attention == "unread":
        return [p for p in items if p.get("isUnread")]
    if attention == "needs_revisit":
        return [p for p in items if p.get("needsRevisit")]
    if attention == "read":
        return [
            p
            for p in items
            if not p.get("isUnread")
            and (p.get("needsRevisit") or p.get("attentionState") == "reviewed")
        ]
    return items
