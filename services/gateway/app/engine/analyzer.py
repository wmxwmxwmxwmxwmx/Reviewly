"""Patch analysis orchestration."""
from __future__ import annotations

from typing import Any, Iterator

from app.engine.chunking import split_files
from app.engine.rules import scan_file
from app.grpc_client.diff_parser import parse_unified_diff


def _file_contents_from_diff(files: list[dict[str, Any]]) -> dict[str, str]:
    contents: dict[str, str] = {}
    for f in files:
        path = f.get("path", "")
        lines: list[str] = []
        for chunk in f.get("chunks", []):
            for line in chunk.get("lines", []):
                if line.get("type") in ("add", "context", "remove"):
                    lines.append(line.get("content", ""))
        contents[path] = "\n".join(lines)
    return contents


def analyze_patch(
    patch: str,
    file_paths: list[str],
    *,
    ignore_lockfiles: bool = True,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Return (findings, chunks)."""
    diff_files = parse_unified_diff(patch) if patch.strip() else []
    if not file_paths and diff_files:
        file_paths = [f["path"] for f in diff_files]

    chunks = split_files(file_paths, ignore_lockfiles=ignore_lockfiles)
    contents = _file_contents_from_diff(diff_files)

    all_findings: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for path in chunks:
        body = contents.get(path, "")
        for finding in scan_file(path, body):
            fid = finding.get("id", "")
            if fid and fid not in seen_ids:
                seen_ids.add(fid)
                all_findings.append(finding)

    return all_findings, chunks


def iter_chunk_progress(
    chunks: list[str],
    findings: list[dict[str, Any]],
) -> Iterator[dict[str, Any]]:
    total = max(len(chunks), 1)
    for i, _path in enumerate(chunks):
        is_last = i == total - 1
        yield {
            "status": "running",
            "progress": int((i + 1) / total * 100),
            "chunkIndex": i + 1,
            "chunkTotal": total,
            "findings": findings if is_last else [],
        }
    yield {
        "status": "completed",
        "progress": 100,
        "chunkIndex": total,
        "chunkTotal": total,
        "findings": findings,
    }
