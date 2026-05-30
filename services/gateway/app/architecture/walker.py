"""Walk repository tree and collect scannable source files."""
from __future__ import annotations

from pathlib import Path

SKIP_DIRS = {
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
}

EXT_LANG = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "typescript",
    ".jsx": "typescript",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".h": "cpp",
    ".hpp": "cpp",
}


def has_scannable_files(root: Path) -> bool:
    """True if the tree contains at least one architecture-scannable source file."""
    root = root.resolve()
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() in EXT_LANG:
            return True
    return False


def worktree_has_files(root: Path) -> bool:
    """True if the clone worktree contains any non-.git file."""
    root = root.resolve()
    for path in root.rglob("*"):
        if path.is_file() and ".git" not in path.parts:
            return True
    return False


def iter_source_files(root: Path, max_files: int) -> list[Path]:
    files: list[Path] = []
    root = root.resolve()
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in EXT_LANG:
            continue
        files.append(path)
        if len(files) >= max_files:
            break
    return files


def language_for(path: Path) -> str:
    return EXT_LANG.get(path.suffix.lower(), "unknown")
