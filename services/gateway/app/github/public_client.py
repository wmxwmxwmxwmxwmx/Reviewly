"""Unauthenticated / PAT GitHub REST access for public repositories."""
from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import api_error
from app.github.github_errors import raise_for_github_response

_API_VERSION = "2022-11-28"


def _has_pat() -> bool:
    return bool(settings.github_pat.strip())


def _auth_headers(*, accept: str = "application/vnd.github+json") -> dict[str, str]:
    headers = {
        "Accept": accept,
        "X-GitHub-Api-Version": _API_VERSION,
    }
    pat = settings.github_pat.strip()
    if pat:
        headers["Authorization"] = f"Bearer {pat}"
    return headers


def _check_response(resp: httpx.Response, *, resource: str) -> None:
    raise_for_github_response(resp, resource=resource, has_pat=_has_pat())


async def get_repo(owner: str, repo: str) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{owner}/{repo}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_auth_headers())
        _check_response(resp, resource="该仓库")
        return resp.json()


async def get_pull_request(owner: str, repo: str, number: int) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_auth_headers())
        _check_response(resp, resource="该 PR")
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
        _check_response(resp, resource="您的仓库列表")
        return resp.json()


async def list_open_pull_requests(owner: str, repo: str) -> list[dict[str, Any]]:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            url,
            headers=_auth_headers(),
            params={"state": "open", "per_page": 100},
        )
        if resp.status_code >= 400:
            _check_response(resp, resource=f"{owner}/{repo} 的 PR 列表")
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
        _check_response(resp, resource="该 PR 的 diff")
        return resp.text
