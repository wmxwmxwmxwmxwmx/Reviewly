"""Clone GitHub repositories into a local cache for architecture scans."""
from __future__ import annotations

import asyncio
import os
import shutil
import stat
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.architecture.walker import has_scannable_files, worktree_has_files
from app.core.config import settings
from app.core.errors import api_error
from app.repositories.repos import get_repo


def _cache_root() -> Path:
    root = Path(settings.prism_repo_cache_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _repo_cache_path(repo_id: str, branch: str) -> Path:
    safe_branch = branch.replace("/", "_") or "main"
    return (_cache_root() / repo_id / safe_branch).resolve()


def _clear_readonly(func, path: str, _exc_info) -> None:
    os.chmod(path, stat.S_IWRITE)
    func(path)


def _remove_path(path: Path) -> None:
    """Remove a cache directory; retry for Windows file locks / read-only files."""
    if not path.exists():
        return
    last_error: OSError | None = None
    for attempt in range(4):
        try:
            shutil.rmtree(path, onerror=_clear_readonly)
            return
        except OSError as exc:
            last_error = exc
            time.sleep(0.25 * (attempt + 1))
    if last_error is not None:
        raise last_error


def _temporary_clone_dir(dest: Path) -> Path:
    token = uuid.uuid4().hex[:10]
    return dest.parent / f".{dest.name}.clone-{token}"


def _git_env() -> dict[str, str]:
    import os

    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    return env


def _run_git(
    args: list[str], *, cwd: Path | None = None, timeout: int | None = None
) -> None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            env=_git_env(),
            check=False,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"git 克隆超时（{timeout}s），请检查网络或在 services/gateway/.env 配置 GITHUB_PAT"
        ) from exc
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "git failed").strip()
        raise RuntimeError(detail)


async def _resolve_token(session: Session, repo_id: str, installation_id: str | None) -> str | None:
    if settings.github_pat.strip():
        return settings.github_pat.strip()
    if installation_id:
        from app.github.app_auth import get_installation_token

        return await get_installation_token(installation_id)
    return None


def _clone_url(full_name: str, token: str | None) -> str:
    if token:
        return f"https://x-access-token:{token}@github.com/{full_name}.git"
    return f"https://github.com/{full_name}.git"


def _is_cache_usable(path: Path) -> bool:
    """Reject stale caches that only contain .git without a usable worktree."""
    git_dir = path / ".git"
    if not git_dir.is_dir():
        return False
    if not worktree_has_files(path):
        return False
    age_hours = (time.time() - git_dir.stat().st_mtime) / 3600
    return age_hours < settings.repo_cache_ttl_hours


def invalidate_repo_cache(repo_id: str, branch: str) -> None:
    dest = _repo_cache_path(repo_id, branch)
    _remove_path(dest)
    for sibling in dest.parent.glob(f".{dest.name}.clone-*"):
        _remove_path(sibling)


def _promote_clone(tmp_dest: Path, dest: Path) -> None:
    """Atomically replace destination cache with a successful temp clone."""
    _remove_path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_dest.replace(dest)


def _clone_repository(url: str, dest: Path, branch: str) -> None:
    """Blocking git clone; run via asyncio.to_thread from async handlers."""
    timeout = settings.git_clone_timeout_seconds
    dest = dest.resolve()
    dest.parent.mkdir(parents=True, exist_ok=True)
    _remove_path(dest)

    strategies: list[list[str]] = [
        ["clone", "--depth", "1", "--branch", branch, url],
        ["clone", "--depth", "1", "--single-branch", url],
        ["clone", "--depth", "1", url],
    ]
    seen: set[tuple[str, ...]] = set()
    last_error = "未知错误"
    tmp_dest: Path | None = None

    try:
        for base_args in strategies:
            key = tuple(base_args)
            if key in seen:
                continue
            seen.add(key)

            if tmp_dest is not None:
                _remove_path(tmp_dest)
            tmp_dest = _temporary_clone_dir(dest)

            try:
                _run_git([*base_args, str(tmp_dest)], timeout=timeout)
            except RuntimeError as exc:
                last_error = str(exc)
                _remove_path(tmp_dest)
                tmp_dest = None
                continue

            if worktree_has_files(tmp_dest):
                _promote_clone(tmp_dest, dest)
                tmp_dest = None
                return

            last_error = "克隆完成但工作区为空，请检查仓库权限、默认分支或 GITHUB_PAT"
            _remove_path(tmp_dest)
            tmp_dest = None
    finally:
        if tmp_dest is not None:
            _remove_path(tmp_dest)

    raise api_error(f"克隆失败: {last_error}", 502)


async def ensure_repo_clone(
    session: Session,
    repo_id: str,
    *,
    force_refresh: bool = False,
) -> dict:
    row_api = get_repo(session, repo_id)
    if row_api is None:
        raise api_error("仓库不存在", 404)

    from app.repositories.repos import get_repo_row

    row = get_repo_row(session, repo_id)
    full_name = row_api.get("fullName") or (row.full_name if row else repo_id)
    branch = row_api.get("defaultBranch", "main")
    installation_id = row.installation_id if row else None

    token = await _resolve_token(session, repo_id, installation_id)
    dest = _repo_cache_path(repo_id, branch)
    dest.parent.mkdir(parents=True, exist_ok=True)

    if force_refresh:
        invalidate_repo_cache(repo_id, branch)

    if not force_refresh and _is_cache_usable(dest):
        return {
            "ok": True,
            "path": str(dest.resolve()),
            "ref": branch,
            "cached": True,
            "clonedAt": datetime.fromtimestamp(
                (dest / ".git").stat().st_mtime, tz=timezone.utc
            ).isoformat().replace("+00:00", "Z"),
        }

    if dest.exists():
        invalidate_repo_cache(repo_id, branch)

    url = _clone_url(full_name, token)
    await asyncio.to_thread(_clone_repository, url, dest, branch)

    if not worktree_has_files(dest):
        raise api_error(
            "克隆完成但仓库工作区为空，请确认 GitHub 访问权限并在 services/gateway/.env 配置 GITHUB_PAT",
            502,
        )

    return {
        "ok": True,
        "path": str(dest.resolve()),
        "ref": branch,
        "cached": False,
        "clonedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def clone_has_scannable_sources(path: Path) -> bool:
    return has_scannable_files(path)
