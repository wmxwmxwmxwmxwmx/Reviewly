"""Resolve PR/repo labels for activity events."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import PullRequest


def pr_context(session: Session, pull_request_id: str) -> tuple[str, str, dict]:
    """Return (repo_label, title, payload)."""
    pr = session.get(PullRequest, pull_request_id)
    if not pr:
        return pull_request_id, pull_request_id, {}
    payload = pr.payload or {}
    repo = payload.get("repo") or payload.get("repoId") or "unknown"
    title = payload.get("title") or f"PR #{pr.number}"
    return str(repo), str(title), payload
