"""Python unified diff parser — mirrors C++ parser output shape (B3)."""
from __future__ import annotations

from typing import Any


def _extension(path: str) -> str:
    if "." not in path:
        return "text"
    return path.rsplit(".", 1)[-1]


def parse_unified_diff(patch: str) -> list[dict[str, Any]]:
    if not patch.strip():
        return []

    files: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    chunk: dict[str, Any] | None = None

    for raw_line in patch.splitlines():
        line = raw_line.rstrip("\r")

        if line.startswith("+++ "):
            path = line[4:]
            if path.startswith("b/"):
                path = path[2:]
            current = {
                "path": path,
                "type": "modified",
                "additions": 0,
                "deletions": 0,
                "riskLevel": "none",
                "language": _extension(path),
                "collapsed": False,
                "chunks": [],
            }
            files.append(current)
            chunk = None
            continue

        if current is None:
            continue

        if line.startswith("@@"):
            chunk = {"header": line, "lines": []}
            current["chunks"].append(chunk)
            continue

        if chunk is None:
            continue

        if line.startswith("+") and not line.startswith("+++"):
            chunk["lines"].append({"type": "add", "newNum": len(chunk["lines"]) + 1, "content": line[1:]})
            current["additions"] += 1
        elif line.startswith("-") and not line.startswith("---"):
            chunk["lines"].append({"type": "delete", "oldNum": len(chunk["lines"]) + 1, "content": line[1:]})
            current["deletions"] += 1
        elif line.startswith(" "):
            chunk["lines"].append({"type": "context", "content": line[1:]})

    return files
