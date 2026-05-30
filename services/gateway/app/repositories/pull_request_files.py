"""Persistence for per-file PR diffs."""
from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import PullRequestFile
from app.grpc_client.diff_parser import parse_unified_diff


def _file_id(pull_request_id: str, filename: str) -> str:
    safe = filename.replace("/", "_")[:80]
    return f"prf-{pull_request_id}-{safe}"[:64]


def _language(path: str) -> str:
    if "." not in path:
        return "text"
    return path.rsplit(".", 1)[-1]


def _github_status_to_type(status: str) -> str:
    mapping = {
        "added": "added",
        "removed": "deleted",
        "deleted": "deleted",
        "renamed": "modified",
        "modified": "modified",
        "changed": "modified",
    }
    return mapping.get(status, "modified")


def _empty_diff_file(stored: dict[str, Any]) -> dict[str, Any]:
    path = stored.get("filename") or stored.get("path", "")
    status = str(stored.get("status") or "modified")
    return {
        "path": path,
        "type": _github_status_to_type(status),
        "additions": int(stored.get("additions") or 0),
        "deletions": int(stored.get("deletions") or 0),
        "riskLevel": "none",
        "language": _language(path),
        "owner": "",
        "collapsed": False,
        "chunks": [],
    }


def _merge_stored_metadata(parsed: dict[str, Any], stored: dict[str, Any]) -> dict[str, Any]:
    status = str(stored.get("status") or "modified")
    path = stored.get("filename") or parsed.get("path", "")
    merged = dict(parsed)
    merged["path"] = path
    merged["type"] = _github_status_to_type(status)
    merged["additions"] = int(stored.get("additions") or merged.get("additions", 0))
    merged["deletions"] = int(stored.get("deletions") or merged.get("deletions", 0))
    merged.setdefault("riskLevel", "none")
    merged.setdefault("language", _language(path))
    merged.setdefault("owner", "")
    merged.setdefault("collapsed", False)
    if not isinstance(merged.get("chunks"), list):
        merged["chunks"] = []
    return merged


def ensure_diff_view_shape(files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Normalize diff rows so the frontend always receives iterable chunks."""
    result: list[dict[str, Any]] = []
    for entry in files:
        path = entry.get("path") or entry.get("filename", "")
        status = entry.get("status") or entry.get("type", "modified")
        row_type = entry.get("type")
        if row_type not in ("modified", "added", "deleted"):
            row_type = _github_status_to_type(str(status))
        chunks = entry.get("chunks")
        result.append(
            {
                "path": path,
                "type": row_type,
                "additions": int(entry.get("additions") or 0),
                "deletions": int(entry.get("deletions") or 0),
                "riskLevel": entry.get("riskLevel", "none"),
                "language": entry.get("language") or _language(path),
                "owner": entry.get("owner", ""),
                "collapsed": bool(entry.get("collapsed", False)),
                "chunks": chunks if isinstance(chunks, list) else [],
            }
        )
    return result


def build_diff_view_rows_from_patch(
    patch: str,
    mapped_files: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build frontend diff rows with parsed chunks from a patch and file metadata."""
    stored = [
        {
            "filename": f["filename"],
            "patch": f.get("patch") or "",
            "additions": f.get("additions", 0),
            "deletions": f.get("deletions", 0),
            "status": f.get("status", "modified"),
        }
        for f in mapped_files
    ]

    parsed_files: list[dict[str, Any]] = []
    if patch.strip():
        parsed_files = parse_unified_diff(patch)

    if not parsed_files and stored:
        wrapped_parts: list[str] = []
        for file_entry in stored:
            file_patch = file_entry.get("patch") or ""
            if file_patch.strip():
                wrapped_parts.append(f"+++ b/{file_entry['filename']}\n{file_patch.lstrip()}")
        if wrapped_parts:
            parsed_files = parse_unified_diff("\n".join(wrapped_parts))

    if parsed_files:
        stored_by_path = {f["filename"]: f for f in stored}
        result: list[dict[str, Any]] = []
        seen: set[str] = set()
        for parsed in parsed_files:
            path = parsed.get("path", "")
            meta = stored_by_path.get(path)
            if meta:
                result.append(_merge_stored_metadata(parsed, meta))
                seen.add(path)
            else:
                parsed.setdefault("owner", "")
                if not isinstance(parsed.get("chunks"), list):
                    parsed["chunks"] = []
                result.append(parsed)
        for file_entry in stored:
            if file_entry["filename"] not in seen:
                result.append(_empty_diff_file(file_entry))
        return result

    if stored:
        return [_empty_diff_file(f) for f in stored]
    return []


def build_diff_view_rows(
    session: Session,
    pr_id: str,
    *,
    pr_patch: str | None = None,
) -> list[dict[str, Any]]:
    """Resolve stored PR files and patch into diff viewer rows."""
    stored = list_files(session, pr_id)
    patch = pr_patch or ""
    if not patch.strip():
        patch = build_combined_patch(session, pr_id)

    mapped_files = [
        {
            "filename": f["filename"],
            "patch": f.get("patch") or "",
            "additions": f.get("additions", 0),
            "deletions": f.get("deletions", 0),
            "status": f.get("status", "modified"),
        }
        for f in stored
    ]
    return build_diff_view_rows_from_patch(patch, mapped_files)


def map_github_file(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "filename": entry["filename"],
        "patch": entry.get("patch") or "",
        "additions": int(entry.get("additions") or 0),
        "deletions": int(entry.get("deletions") or 0),
        "status": str(entry.get("status") or "modified"),
    }


def to_diff_view_rows(files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Legacy shape for path-only consumers; always includes empty chunks."""
    return ensure_diff_view_shape(
        [
            {
                "path": f["filename"],
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "status": f.get("status", "modified"),
            }
            for f in files
        ]
    )


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
