"""Walk repository tree and collect scannable source files."""
from __future__ import annotations

import heapq
import os
from pathlib import Path

SKIP_DIRS = frozenset(
    {
        ".git",
        "node_modules",
        "venv",
        ".venv",
        "__pycache__",
        "dist",
        "build",
        ".next",
        "target",
        "vendor",
        ".turbo",
        "coverage",
        ".pnpm-store",
        "storybook-static",
        "generated",
        "repo-cache",
        "data",
        "tmp",
        "temp",
        ".idea",
        ".vscode",
        ".cache",
        "out",
        "__tests__",
        "tests",
        "test",
        "spec",
        "e2e",
        "cypress",
    }
)

# Prefer application source when truncating large monorepos (lower index = higher priority).
PRIORITY_SEGMENTS: tuple[str, ...] = (
    "apps",
    "services",
    "packages",
    "src",
    "lib",
    "server",
    "gateway",
    "web",
    "backend",
    "frontend",
)

_PRIORITY_RANK = {name: idx for idx, name in enumerate(PRIORITY_SEGMENTS)}

EXT_LANG: dict[str, str] = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "typescript",
    ".jsx": "typescript",
    ".mjs": "typescript",
    ".cjs": "typescript",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".h": "cpp",
    ".hpp": "cpp",
}


def _path_priority(path: Path, root: Path) -> tuple[int, str]:
    rel = path.relative_to(root).as_posix()
    best = len(PRIORITY_SEGMENTS)
    for part in rel.split("/"):
        rank = _PRIORITY_RANK.get(part)
        if rank is not None and rank < best:
            best = rank
    return (best, rel)


def _is_skipped_dir(name: str) -> bool:
    return name in SKIP_DIRS or name.startswith(".")


def _walk_scannable_files(root: Path):
    """Yield scannable file paths; pruned os.walk — O(files), no full list materialized."""
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        dirnames[:] = [d for d in dirnames if not _is_skipped_dir(d)]
        base = Path(dirpath)
        for name in filenames:
            suffix = Path(name).suffix.lower()
            if suffix in EXT_LANG:
                yield base / name


def has_scannable_files(root: Path) -> bool:
    root = root.resolve()
    for _ in _walk_scannable_files(root):
        return True
    return False


def worktree_has_files(root: Path) -> bool:
    root = root.resolve()
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        if ".git" in Path(dirpath).parts:
            continue
        dirnames[:] = [d for d in dirnames if d not in {".git"}]
        if filenames:
            return True
    return False


def iter_source_files(root: Path, max_files: int) -> tuple[list[Path], int, bool]:
    """
    Return (selected_files, total_discovered, truncated).

    Uses a size-K max-heap: O(N log K) time, O(K) extra memory vs O(N log N) full sort.
  """
    root = root.resolve()
    if max_files <= 0:
        return [], 0, False

    # Max-heap entries: (priority_tuple, seq, path). Root = worst among kept K files.
    heap: list[tuple[tuple[int, str], int, Path]] = []
    seq = 0
    total = 0

    for path in _walk_scannable_files(root):
        total += 1
        seq += 1
        item = (_path_priority(path, root), seq, path)
        if len(heap) < max_files:
            heapq.heappush(heap, item)
        elif item < heap[0]:
            heapq.heapreplace(heap, item)

    truncated = total > max_files
    selected = [path for _, _, path in sorted(heap, key=lambda x: (x[0], x[1]))]
    return selected, total, truncated


def language_for(path: Path) -> str:
    return EXT_LANG.get(path.suffix.lower(), "unknown")
