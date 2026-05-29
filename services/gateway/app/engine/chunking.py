"""File chunking for analysis (mirrors services/engine chunking)."""
from __future__ import annotations


def split_files(file_paths: list[str], *, ignore_lockfiles: bool = True) -> list[str]:
    out: list[str] = []
    for path in file_paths:
        if ignore_lockfiles and (
            "package-lock" in path or "pnpm-lock" in path or path.endswith("yarn.lock")
        ):
            continue
        out.append(path)
    return out or file_paths[:1] or ["unknown"]
