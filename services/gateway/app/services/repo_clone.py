"""Clone GitHub repositories into a local cache for architecture scans."""
from __future__ import annotations

import asyncio
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.repositories.repos import get_repo


def _cache_root() -> Path:
    root = Path(settings.prism_repo_cache_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _repo_cache_path(repo_id: str, branch: str) -> Path:
    safe_branch = branch.replace("/", "_") or "main"
    return _cache_root() / repo_id / safe_branch


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


def _is_cache_fresh(path: Path) -> bool:
    git_dir = path / ".git"
    if not git_dir.is_dir():
        return False
    age_hours = (time.time() - git_dir.stat().st_mtime) / 3600
    return age_hours < settings.repo_cache_ttl_hours


def _clone_repository(url: str, dest: Path, branch: str) -> None:
    """Blocking git clone; run via asyncio.to_thread from async handlers."""
    timeout = settings.git_clone_timeout_seconds
    if dest.exists():
        import shutil

        shutil.rmtree(dest, ignore_errors=True)

    try:
        _run_git(
            ["clone", "--depth", "1", "--branch", branch, url, str(dest)],
            timeout=timeout,
        )
    except RuntimeError as exc:
        if branch != "main":
            try:
                _run_git(
                    ["clone", "--depth", "1", url, str(dest)],
                    timeout=timeout,
                )
            except RuntimeError as exc2:
                raise api_error(f"克隆失败: {exc2}", 502) from exc2
        else:
            raise api_error(f"克隆失败: {exc}", 502) from exc


async def ensure_repo_clone(session: Session, repo_id: str) -> dict:
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

    if _is_cache_fresh(dest):
        return {
            "ok": True,
            "path": str(dest.resolve()),
            "ref": branch,
            "cached": True,
            "clonedAt": datetime.fromtimestamp(
                (dest / ".git").stat().st_mtime, tz=timezone.utc
            ).isoformat().replace("+00:00", "Z"),
        }

    url = _clone_url(full_name, token)
    await asyncio.to_thread(_clone_repository, url, dest, branch)

    return {
        "ok": True,
        "path": str(dest.resolve()),
        "ref": branch,
        "cached": False,
        "clonedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
