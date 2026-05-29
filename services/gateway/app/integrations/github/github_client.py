"""GitHub REST client using installation tokens."""
from __future__ import annotations

from typing import Any

import httpx

from app.github.github_errors import raise_for_github_response
from app.integrations.github.installation_tokens import get_installation_token

_API_VERSION = "2022-11-28"


class GitHubClient:
    def __init__(self, installation_id: str) -> None:
        self._installation_id = installation_id
        self._token: str | None = None

    async def _headers(self, *, accept: str = "application/vnd.github+json") -> dict[str, str]:
        if not self._token:
            self._token = await get_installation_token(self._installation_id)
        return {
            "Authorization": f"Bearer {self._token}",
            "Accept": accept,
            "X-GitHub-Api-Version": _API_VERSION,
        }

    async def _get_json(self, url: str, *, resource: str, params: dict | None = None) -> Any:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url, headers=await self._headers(), params=params)
            raise_for_github_response(resp, resource=resource, has_pat=True)
            return resp.json()

    async def list_repos(self) -> list[dict[str, Any]]:
        data = await self._get_json(
            "https://api.github.com/installation/repositories",
            resource="installation repositories",
            params={"per_page": 100},
        )
        return data.get("repositories", [])

    async def list_pull_requests(self, owner: str, repo: str) -> list[dict[str, Any]]:
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
        return await self._get_json(
            url,
            resource=f"{owner}/{repo} pull requests",
            params={"state": "open", "per_page": 100},
        )

    async def get_pull_request(self, owner: str, repo: str, number: int) -> dict[str, Any]:
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
        return await self._get_json(url, resource="pull request")

    async def list_pull_files(self, owner: str, repo: str, number: int) -> list[dict[str, Any]]:
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files"
        return await self._get_json(
            url,
            resource="pull request files",
            params={"per_page": 100},
        )

    async def list_pull_commits(self, owner: str, repo: str, number: int) -> list[dict[str, Any]]:
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/commits"
        return await self._get_json(
            url,
            resource="pull request commits",
            params={"per_page": 100},
        )

    async def get_pull_diff_patch(self, owner: str, repo: str, number: int) -> str:
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(
                url,
                headers={**(await self._headers(accept="application/vnd.github.v3.diff"))},
            )
            raise_for_github_response(resp, resource="pull request diff", has_pat=True)
            return resp.text
