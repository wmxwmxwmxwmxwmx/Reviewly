"""GitHub pull request API helpers."""
from __future__ import annotations

from typing import Any

from app.github.http_client import GitHubHttpClient


async def fetch_repo_pull_requests(
    owner: str,
    repo: str,
    token: str,
    *,
    state: str = "open",
) -> list[dict[str, Any]]:
    client = GitHubHttpClient(token)
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    return await client.get_paginated_list(
        url,
        resource=f"{owner}/{repo} pull requests",
        params={"state": state, "per_page": 100},
    )


async def fetch_pull_request_diff(
    owner: str,
    repo: str,
    number: int,
    token: str,
) -> str:
    client = GitHubHttpClient(token)
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}"
    return await client.get_text(
        url,
        resource=f"PR #{number} diff",
        accept="application/vnd.github.v3.diff",
    )
