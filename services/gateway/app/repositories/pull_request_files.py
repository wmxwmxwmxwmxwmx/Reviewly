"""Persistence for per-file PR diffs."""
from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import PullRequestFile


def _file_id(pull_request_id: str, filename: str) -> str:
    safe = filename.replace("/", "_")[:80]
    return f"prf-{pull_request_id}-{safe}"[:64]


def map_github_file(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "filename": entry["filename"],
        "patch": entry.get("patch") or "",
        "additions": int(entry.get("additions") or 0),
        "deletions": int(entry.get("deletions") or 0),
        "status": str(entry.get("status") or "modified"),
    }


def to_diff_view_rows(files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Shape expected by engine / diff viewer (`path` key)."""
    return [
        {
            "path": f["filename"],
            "additions": f.get("additions", 0),
            "deletions": f.get("deletions", 0),
            "status": f.get("status", "modified"),
        }
        for f in files
    ]


def replace_files(
    session: Session,
    pull_request_id: str,
    files: list[dict[str, Any]],
) -> list[PullRequestFile]:
    session.execute(
        delete(PullRequestFile).where(PullRequestFile.pull_request_id == pull_request_id)
    )
    rows: list[PullRequestFile] = []
    for entry in files:
        mapped = map_github_file(entry)
        row = PullRequestFile(
            id=_file_id(pull_request_id, mapped["filename"]),
            pull_request_id=pull_request_id,
            filename=mapped["filename"],
            patch=mapped["patch"] or None,
            additions=mapped["additions"],
            deletions=mapped["deletions"],
            status=mapped["status"],
        )
        session.add(row)
        rows.append(row)
    session.flush()
    return rows


def list_files(session: Session, pull_request_id: str) -> list[dict[str, Any]]:
    rows = session.scalars(
        select(PullRequestFile)
        .where(PullRequestFile.pull_request_id == pull_request_id)
        .order_by(PullRequestFile.filename)
    ).all()
    return [
        {
            "id": row.id,
            "pullRequestId": row.pull_request_id,
            "filename": row.filename,
            "patch": row.patch or "",
            "additions": row.additions,
            "deletions": row.deletions,
            "status": row.status,
        }
        for row in rows
    ]


def build_combined_patch(session: Session, pull_request_id: str) -> str:
    rows = session.scalars(
        select(PullRequestFile)
        .where(PullRequestFile.pull_request_id == pull_request_id)
        .order_by(PullRequestFile.filename)
    ).all()
    parts: list[str] = []
    for row in rows:
        if row.patch:
            parts.append(row.patch)
    return "\n".join(parts)


def file_paths(session: Session, pull_request_id: str) -> list[str]:
    rows = session.scalars(
        select(PullRequestFile.filename).where(
            PullRequestFile.pull_request_id == pull_request_id
        )
    ).all()
    return list(rows)

