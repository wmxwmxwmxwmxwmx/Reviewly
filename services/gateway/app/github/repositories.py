"""GitHub repository REST API (fetch by URL, list user repos with pagination)."""
from __future__ import annotations

import logging
from typing import Any
import httpx

from app.core.config import settings
from app.core.errors import api_error
from app.github.github_errors import raise_for_github_response
from app.github.url_parser import parse_github_repo_url

logger = logging.getLogger(__name__)

_API_VERSION = "2022-11-28"
_USER_REPOS_URL = "https://api.github.com/user/repos"


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


def _next_page_url(link_header: str | None) -> str | None:
    if not link_header:
        return None
    for part in link_header.split(","):
        segment = part.strip()
        if 'rel="next"' in segment:
            start = segment.find("<")
            end = segment.find(">")
            if start >= 0 and end > start:
                return segment[start + 1 : end]
    return None


async def fetch_repo(owner: str, repo: str) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{owner}/{repo}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_auth_headers())
        _check_response(resp, resource="Repository not found")
        return resp.json()


async def fetch_repo_by_url(url: str) -> dict[str, Any]:
    parsed = parse_github_repo_url(url)
    logger.info("Fetching GitHub repository %s", parsed.full_name)
    return await fetch_repo(parsed.owner, parsed.repo)


async def fetch_user_repositories() -> list[dict[str, Any]]:
    if not _has_pat():
        raise api_error("GitHub PAT not configured", 500)

    all_repos: list[dict[str, Any]] = []
    next_url: str | None = _USER_REPOS_URL
    page = 0

    async with httpx.AsyncClient(timeout=60.0) as client:
        while next_url:
            page += 1
            if next_url == _USER_REPOS_URL:
                resp = await client.get(
                    next_url,
                    headers=_auth_headers(),
                    params={
                        "affiliation": "owner,collaborator,organization_member",
                        "per_page": 100,
                        "sort": "updated",
                    },
                )
            else:
                resp = await client.get(next_url, headers=_auth_headers())

            _check_response(resp, resource="your repository list")
            batch = resp.json()
            if isinstance(batch, list):
                all_repos.extend(batch)
            next_url = _next_page_url(resp.headers.get("Link"))
            logger.info("Fetched GitHub repos page %s (%s items)", page, len(batch) if isinstance(batch, list) else 0)

    logger.info("Fetched %s repositories from GitHub", len(all_repos))
    return all_repos


def parse_repo_url_for_owner_repo(url: str) -> tuple[str, str]:
    """Utility for callers that already have a URL string."""
    parsed = parse_github_repo_url(url)
    return parsed.owner, parsed.repo
