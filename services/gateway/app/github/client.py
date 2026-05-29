"""GitHub REST client (B3)."""
from __future__ import annotations

from typing import Any

import httpx

from app.github.app_auth import get_installation_token


class GitHubClient:
    def __init__(self, installation_id: str) -> None:
        self._installation_id = installation_id
        self._token: str | None = None

    async def _headers(self) -> dict[str, str]:
        if not self._token:
            self._token = await get_installation_token(self._installation_id)
        return {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def list_repos(self) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(
                "https://api.github.com/installation/repositories",
                headers=await self._headers(),
                params={"per_page": 100},
            )
            resp.raise_for_status()
            return resp.json().get("repositories", [])

    async def list_pull_requests(self, owner: str, repo: str) -> list[dict[str, Any]]:
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(
                url,
                headers=await self._headers(),
                params={"state": "open", "per_page": 100},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_pull_request(self, owner: str, repo: str, number: int) -> dict[str, Any]:
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url, headers=await self._headers())
            resp.raise_for_status()
            return resp.json()

    async def get_pull_diff_patch(self, owner: str, repo: str, number: int) -> str:
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(
                url,
                headers={**(await self._headers()), "Accept": "application/vnd.github.v3.diff"},
            )
            resp.raise_for_status()
            return resp.text
