"""Unified GitHub REST HTTP client with pagination and error handling."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.github.github_errors import raise_for_github_response

logger = logging.getLogger(__name__)

_API_VERSION = "2022-11-28"


class GitHubHttpClient:
    def __init__(self, token: str) -> None:
        self._token = token.strip()
        if not self._token:
            raise ValueError("GitHub token is required")

    def _headers(self, *, accept: str = "application/vnd.github+json") -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Accept": accept,
            "X-GitHub-Api-Version": _API_VERSION,
        }

    def _check(self, resp: httpx.Response, *, resource: str) -> None:
        raise_for_github_response(resp, resource=resource, has_pat=True)

    @staticmethod
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

    async def get_json(self, url: str, *, resource: str, params: dict | None = None) -> Any:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url, headers=self._headers(), params=params)
            self._check(resp, resource=resource)
            return resp.json()

    async def get_paginated_list(
        self,
        url: str,
        *,
        resource: str,
        params: dict | None = None,
    ) -> list[dict[str, Any]]:
        all_items: list[dict[str, Any]] = []
        next_url: str | None = url
        page = 0
        base_params = dict(params or {})

        async with httpx.AsyncClient(timeout=60.0) as client:
            while next_url:
                page += 1
                if next_url == url:
                    resp = await client.get(
                        next_url, headers=self._headers(), params=base_params
                    )
                else:
                    resp = await client.get(next_url, headers=self._headers())
                self._check(resp, resource=resource)
                batch = resp.json()
                if isinstance(batch, list):
                    all_items.extend(batch)
                next_url = self._next_page_url(resp.headers.get("Link"))
                logger.debug("GitHub paginated %s page %s (%s items)", url, page, len(batch) if isinstance(batch, list) else 0)

        return all_items

    async def get_text(
        self,
        url: str,
        *,
        resource: str,
        accept: str = "application/vnd.github+json",
    ) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(url, headers=self._headers(accept=accept))
            self._check(resp, resource=resource)
            return resp.text
