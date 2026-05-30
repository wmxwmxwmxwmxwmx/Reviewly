"""Tests for architecture file walker helpers."""
from __future__ import annotations

from pathlib import Path

from app.architecture.walker import has_scannable_files, iter_source_files, worktree_has_files


def test_worktree_has_files_detects_non_git_files(tmp_path: Path) -> None:
    (tmp_path / ".git").mkdir()
    assert worktree_has_files(tmp_path) is False
    (tmp_path / "README.md").write_text("hi", encoding="utf-8")
    assert worktree_has_files(tmp_path) is True


def test_has_scannable_files_detects_typescript(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "index.ts").write_text("export {}", encoding="utf-8")
    assert has_scannable_files(tmp_path) is True


def test_iter_source_files_prioritizes_apps_dir(tmp_path: Path) -> None:
    junk = tmp_path / "junk"
    apps = tmp_path / "apps" / "web"
    junk.mkdir(parents=True)
    apps.mkdir(parents=True)
    for i in range(8):
        (junk / f"file{i}.ts").write_text("export {}", encoding="utf-8")
    for i in range(3):
        (apps / f"page{i}.tsx").write_text("export {}", encoding="utf-8")

    selected, total, truncated = iter_source_files(tmp_path, max_files=3)
    assert total == 11
    assert truncated is True
    assert len(selected) == 3
    assert all("apps" in p.as_posix() for p in selected)

