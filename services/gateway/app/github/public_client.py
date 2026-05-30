"""Unauthenticated / PAT GitHub REST access for public repositories."""
from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import api_error
from app.github.github_errors import raise_for_github_response

_API_VERSION = "2022-11-28"


def _has_auth(access_token: str | None) -> bool:
    if access_token and access_token.strip():
        return True
    return bool(settings.github_pat.strip())


def _auth_headers(
    *,
    accept: str = "application/vnd.github+json",
    access_token: str | None = None,
) -> dict[str, str]:
    headers = {
        "Accept": accept,
        "X-GitHub-Api-Version": _API_VERSION,
    }
    token = (access_token or "").strip() or settings.github_pat.strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _check_response(
    resp: httpx.Response,
    *,
    resource: str,
    access_token: str | None = None,
) -> None:
    raise_for_github_response(resp, resource=resource, has_pat=_has_auth(access_token))


async def get_repo(owner: str, repo: str) -> dict[str, Any]:
    from app.github.repositories import fetch_repo

    return await fetch_repo(owner, repo)


async def get_repo_public(
    owner: str,
    repo: str,
    *,
    access_token: str | None = None,
) -> dict[str, Any]:
    """Fetch repo metadata with optional token (works for public repos without auth)."""
    url = f"https://api.github.com/repos/{owner}/{repo}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_auth_headers(access_token=access_token))
        _check_response(resp, resource="该仓库", access_token=access_token)
        return resp.json()


async def get_pull_request(
    owner: str,
    repo: str,
    number: int,
    *,
    access_token: str | None = None,
) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_auth_headers(access_token=access_token))
        _check_response(resp, resource="该 PR", access_token=access_token)
        return resp.json()


async def list_user_repos() -> list[dict[str, Any]]:
    from app.github.repositories import fetch_user_repositories

    return await fetch_user_repositories()


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


async def list_pull_files(
    owner: str,
    repo: str,
    number: int,
    *,
    access_token: str | None = None,
) -> list[dict[str, Any]]:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            url,
            headers=_auth_headers(access_token=access_token),
            params={"per_page": 100},
        )
        _check_response(resp, resource="该 PR 的文件列表", access_token=access_token)
        data = resp.json()
        return data if isinstance(data, list) else []


async def list_pull_commits(
    owner: str,
    repo: str,
    number: int,
    *,
    access_token: str | None = None,
) -> list[dict[str, Any]]:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/commits"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(
            url,
            headers=_auth_headers(access_token=access_token),
            params={"per_page": 100},
        )
        _check_response(resp, resource="该 PR 的 commits", access_token=access_token)
        data = resp.json()
        return data if isinstance(data, list) else []


async def get_pull_diff_patch(
    owner: str,
    repo: str,
    number: int,
    *,
    access_token: str | None = None,
) -> str:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(
            url,
            headers=_auth_headers(accept="application/vnd.github.v3.diff", access_token=access_token),
        )
        _check_response(resp, resource="该 PR 的 diff", access_token=access_token)
        return resp.text
