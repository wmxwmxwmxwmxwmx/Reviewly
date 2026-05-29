"""GitHub repository context for AI repo analysis (README, tree, configs)."""
from __future__ import annotations

import base64
import logging
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AuthUser, Repository
from app.github import public_client
from app.github.http_client import GitHubHttpClient
from app.integrations.github.installation_tokens import get_installation_token
from app.repositories import auth_users as auth_users_repo

logger = logging.getLogger(__name__)

_CONFIG_PATHS = (
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
    "pyproject.toml",
    "requirements.txt",
    "go.mod",
    "Cargo.toml",
    "docker-compose.yml",
    "README.md",
)

_MAX_TREE_PATHS = 400
_MAX_README_CHARS = 8000
_MAX_CONFIG_CHARS = 3500
_API_VERSION = "2022-11-28"

# Monorepo roots first; bulky non-code trees last (e.g. .agents/skills).
_TREE_PRIORITY_PREFIXES = (
    "apps/",
    "services/",
    "packages/",
    "scripts/",
    "docs/",
)
_TREE_DEPRIORITIZE_PREFIXES = (
    ".agents/",
    ".git/",
    "node_modules/",
)


def _tree_path_rank(path: str) -> tuple[int, str]:
    normalized = path.replace("\\", "/")
    if any(normalized.startswith(prefix) for prefix in _TREE_PRIORITY_PREFIXES):
        return (0, normalized)
    if "/" not in normalized:
        return (1, normalized)
    if any(normalized.startswith(prefix) for prefix in _TREE_DEPRIORITIZE_PREFIXES):
        return (3, normalized)
    return (2, normalized)


def _select_tree_paths(paths: list[str], limit: int) -> tuple[list[str], bool]:
    """Pick paths for AI context: monorepo dirs before alphabetical noise."""
    ordered = sorted(paths, key=_tree_path_rank)
    truncated = len(ordered) > limit
    return ordered[:limit], truncated


def _headers(token: str | None, *, accept: str = "application/vnd.github+json") -> dict[str, str]:
    headers = {"Accept": accept, "X-GitHub-Api-Version": _API_VERSION}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _get_json(
    url: str,
    token: str | None,
    *,
    resource: str,
    params: dict | None = None,
) -> Any:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_headers(token), params=params)
        if resp.status_code >= 400:
            from app.github.github_errors import raise_for_github_response

            raise_for_github_response(
                resp, resource=resource, has_pat=bool(token or settings.github_pat.strip())
            )
        return resp.json()


async def resolve_access_token(
    session: Session,
    repo_row: Repository,
    user: AuthUser | None,
) -> str | None:
    """OAuth user token → installation token → GITHUB_PAT → anonymous."""
    if user:
        token = auth_users_repo.decrypt_token(user.access_token_encrypted)
        if token:
            return token

    if repo_row.installation_id and settings.github_app_id and settings.github_app_private_key:
        try:
            return await get_installation_token(repo_row.installation_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Installation token failed for %s: %s", repo_row.full_name, exc)

    pat = settings.github_pat.strip()
    return pat or None


async def fetch_readme(owner: str, repo: str, token: str | None) -> tuple[str, str | None]:
    if not owner or not repo:
        return "", "缺少 owner/repo，无法请求 README"
    if token:
        client = GitHubHttpClient(token)
        try:
            text = await client.get_text(
                f"https://api.github.com/repos/{owner}/{repo}/readme",
                resource="README",
                accept="application/vnd.github.raw",
            )
            return text[:_MAX_README_CHARS], None
        except Exception as exc:  # noqa: BLE001
            logger.info("README fetch with token failed for %s/%s: %s", owner, repo, exc)
    try:
        text = await public_client.get_readme(owner, repo)
        if text:
            return text[:_MAX_README_CHARS], None
        return "", "无法读取 README（仓库可能为私有，请登录 GitHub 或配置 GITHUB_PAT）"
    except Exception as exc:  # noqa: BLE001
        logger.info("Public README fetch failed for %s/%s: %s", owner, repo, exc)
        return "", f"README 请求失败：{exc}"


async def fetch_file_tree(
    owner: str,
    repo: str,
    token: str | None,
    *,
    default_branch: str = "main",
) -> tuple[str, str | None]:
    if not owner or not repo:
        return "", "缺少 owner/repo，无法构建目录树"

    branch = default_branch or "main"
    try:
        ref = await _get_json(
            f"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{branch}",
            token,
            resource=f"分支 {branch}",
        )
        commit_sha = ref.get("object", {}).get("sha")
        if not commit_sha:
            return "", f"无法解析分支 {branch} 的 commit"
        tree_data = await _get_json(
            f"https://api.github.com/repos/{owner}/{repo}/git/trees/{commit_sha}",
            token,
            resource="目录树",
            params={"recursive": "1"},
        )
    except Exception as exc:  # noqa: BLE001
        logger.info("File tree fetch failed for %s/%s: %s", owner, repo, exc)
        if not token:
            return (
                "",
                "目录树请求失败：私有仓库或未授权访问，请确认已在 PRism 登录 GitHub"
                "（非仅 GitHub 网站登录），或在 .env 配置 GITHUB_PAT。",
            )
        return "", f"目录树请求失败：{exc}"

    entries = tree_data.get("tree") or []
    paths: list[str] = []
    for item in entries:
        if item.get("type") != "blob":
            continue
        path = item.get("path")
        if isinstance(path, str) and path:
            paths.append(path)
    display, truncated = _select_tree_paths(paths, _MAX_TREE_PATHS)
    truncated = truncated or bool(tree_data.get("truncated"))
    note = ""
    if truncated:
        note = f"\n（已截断，共展示 {len(display)}/{len(paths)} 条路径；优先保留 apps/、services/、packages/）"
    if not display:
        return "", "仓库树为空或无法解析文件路径"
    return "\n".join(display) + note, None


async def fetch_config_snippets(
    owner: str,
    repo: str,
    token: str | None,
) -> dict[str, str]:
    if not owner or not repo:
        return {}

    snippets: dict[str, str] = {}
    for path in _CONFIG_PATHS:
        if path == "README.md":
            continue
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
        try:
            data = await _get_json(url, token, resource=path)
        except Exception:  # noqa: BLE001
            continue
        if not isinstance(data, dict):
            continue
        raw = _decode_content(data)
        if raw:
            snippets[path] = raw[:_MAX_CONFIG_CHARS]
    return snippets


def _decode_content(data: dict[str, Any]) -> str:
    content = data.get("content")
    if not isinstance(content, str):
        return ""
    encoding = data.get("encoding", "base64")
    if encoding == "base64":
        try:
            return base64.b64decode(content).decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            return ""
    return content
