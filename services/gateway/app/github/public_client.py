"""Unauthenticated / PAT GitHub REST access for public repositories."""
from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import api_error

_API_VERSION = "2022-11-28"


def _auth_headers(*, accept: str = "application/vnd.github+json") -> dict[str, str]:
    headers = {
        "Accept": accept,
        "X-GitHub-Api-Version": _API_VERSION,
    }
    pat = settings.github_pat.strip()
    if pat:
        headers["Authorization"] = f"Bearer {pat}"
    return headers


async def get_repo(owner: str, repo: str) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{owner}/{repo}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_auth_headers())
        if resp.status_code in (403, 404):
            raise api_error(
                "无法访问该仓库（可能为私有仓库）。请安装 GitHub App 或在 .env 配置 GITHUB_PAT。",
                403,
            )
        resp.raise_for_status()
        return resp.json()


async def get_pull_request(owner: str, repo: str, number: int) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_auth_headers())
        if resp.status_code in (403, 404):
            raise api_error(
                "无法访问该 PR（可能为私有仓库）。请安装 GitHub App 或在 .env 配置 GITHUB_PAT。",
                403,
            )
        resp.raise_for_status()
        return resp.json()


async def list_user_repos() -> list[dict[str, Any]]:
    if not settings.github_pat.strip():
        raise api_error("请配置 GITHUB_PAT 以同步用户仓库。", 501)

    url = "https://api.github.com/user/repos"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            url,
            headers=_auth_headers(),
            params={"affiliation": "owner,collaborator,organization_member", "per_page": 100, "sort": "updated"},
        )
        if resp.status_code in (401, 403):
            raise api_error("GitHub PAT 无效或权限不足，无法列出仓库。", 403)
        resp.raise_for_status()
        return resp.json()


async def list_open_pull_requests(owner: str, repo: str) -> list[dict[str, Any]]:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            url,
            headers=_auth_headers(),
            params={"state": "open", "per_page": 100},
        )
        if resp.status_code in (403, 404):
            raise api_error(
                f"无法访问 {owner}/{repo} 的 PR 列表。",
                403,
            )
        resp.raise_for_status()
        return resp.json()


async def get_readme(owner: str, repo: str) -> str:
    url = f"https://api.github.com/repos/{owner}/{repo}/readme"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, headers=_auth_headers(accept="application/vnd.github.raw"))
        if resp.status_code in (403, 404):
            return ""
        resp.raise_for_status()
        return resp.text


async def get_pull_diff_patch(owner: str, repo: str, number: int) -> str:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(
            url,
            headers=_auth_headers(accept="application/vnd.github.v3.diff"),
        )
        if resp.status_code in (403, 404):
            raise api_error(
                "无法获取 PR diff（可能为私有仓库）。请安装 GitHub App 或在 .env 配置 GITHUB_PAT。",
                403,
            )
        resp.raise_for_status()
        return resp.text
