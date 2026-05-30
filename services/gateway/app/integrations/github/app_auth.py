"""GitHub App JWT and installation discovery."""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx
import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

_API_VERSION = "2022-11-28"


def _normalize_private_key(pem: str) -> str:
    return pem.replace("\\n", "\n").strip()


def create_app_jwt() -> str:
    if not settings.github_app_id or not settings.github_app_private_key:
        raise RuntimeError("GitHub App credentials are not configured")

    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + 600,
        "iss": settings.github_app_id,
    }
    return jwt.encode(
        payload,
        _normalize_private_key(settings.github_app_private_key),
        algorithm="RS256",
    )


async def get_installation_id_for_repo(owner: str, repo: str) -> str | None:
    """Return installation id when the GitHub App is installed on owner/repo."""
    if not settings.github_app_id or not settings.github_app_private_key:
        return None

    try:
        app_jwt = create_app_jwt()
    except Exception as exc:
        logger.warning("GitHub App JWT creation failed for %s/%s: %s", owner, repo, exc)
        return None

    url = f"https://api.github.com/repos/{owner}/{repo}/installation"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {app_jwt}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": _API_VERSION,
                },
            )
            if resp.status_code == 404:
                return None
            if resp.status_code >= 400:
                logger.warning(
                    "GitHub installation lookup failed for %s/%s: HTTP %s",
                    owner,
                    repo,
                    resp.status_code,
                )
                return None
            data: dict[str, Any] = resp.json()
            inst_id = data.get("id")
            return str(inst_id) if inst_id is not None else None
    except httpx.HTTPError as exc:
        logger.warning(
            "GitHub installation lookup error for %s/%s: %s",
            owner,
            repo,
            exc,
        )
        return None
