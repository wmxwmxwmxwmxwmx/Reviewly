"""Tests for architecture file walker helpers."""
from __future__ import annotations

from pathlib import Path

from app.architecture.walker import has_scannable_files, worktree_has_files


def test_worktree_has_files_detects_non_git_files(tmp_path: Path) -> None:
    (tmp_path / ".git").mkdir()
    assert worktree_has_files(tmp_path) is False
    (tmp_path / "README.md").write_text("hi", encoding="utf-8")
    assert worktree_has_files(tmp_path) is True


def test_has_scannable_files_detects_typescript(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "index.ts").write_text("export {}", encoding="utf-8")
    assert has_scannable_files(tmp_path) is True
