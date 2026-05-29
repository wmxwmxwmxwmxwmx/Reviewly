"""GitHub repository REST API (fetch by URL, list user repos with pagination)."""
from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings
from app.core.errors import api_error
from app.github.http_client import GitHubHttpClient
from app.github.url_parser import parse_github_repo_url

logger = logging.getLogger(__name__)

_USER_REPOS_URL = "https://api.github.com/user/repos"


def resolve_github_token(user_token: str | None) -> str:
    token = (user_token or "").strip() or settings.github_pat.strip()
    if not token:
        raise api_error("GitHub PAT not configured", 500)
    return token


async def fetch_repo(owner: str, repo: str, token: str | None = None) -> dict[str, Any]:
    access = resolve_github_token(token)
    client = GitHubHttpClient(access)
    url = f"https://api.github.com/repos/{owner}/{repo}"
    return await client.get_json(url, resource="Repository not found")


async def fetch_repo_by_url(url: str, token: str | None = None) -> dict[str, Any]:
    parsed = parse_github_repo_url(url)
    logger.info("Fetching GitHub repository %s", parsed.full_name)
    return await fetch_repo(parsed.owner, parsed.repo, token)


async def fetch_user_repositories(token: str | None = None) -> list[dict[str, Any]]:
    access = resolve_github_token(token)
    client = GitHubHttpClient(access)
    repos = await client.get_paginated_list(
        _USER_REPOS_URL,
        resource="your repository list",
        params={
            "affiliation": "owner,collaborator,organization_member",
            "per_page": 100,
            "sort": "updated",
        },
    )
    logger.info("Fetched %s repositories from GitHub", len(repos))
    return repos
