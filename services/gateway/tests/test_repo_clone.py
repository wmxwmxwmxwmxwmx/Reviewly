"""Tests for repository clone cache helpers."""
from __future__ import annotations

from pathlib import Path

from app.services.repo_clone import _promote_clone, _remove_path, _temporary_clone_dir


def test_promote_clone_replaces_existing_destination(tmp_path: Path) -> None:
    dest = tmp_path / "main"
    dest.mkdir()
    stale = dest / "stale.txt"
    stale.write_text("old", encoding="utf-8")

    tmp_dest = _temporary_clone_dir(dest)
    tmp_dest.mkdir()
    (tmp_dest / "app.py").write_text("print('ok')", encoding="utf-8")

    _promote_clone(tmp_dest, dest)

    assert dest.is_dir()
    assert not tmp_dest.exists()
    assert not stale.exists()
    assert (dest / "app.py").read_text(encoding="utf-8") == "print('ok')"


def test_remove_path_clears_nested_tree(tmp_path: Path) -> None:
    target = tmp_path / "cache" / "main"
    target.mkdir(parents=True)
    (target / ".git").mkdir()
    (target / "src").mkdir()
    (target / "src" / "index.ts").write_text("export {}", encoding="utf-8")

    _remove_path(target)

    assert not target.exists()
