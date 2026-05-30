"""GitHub App JWT and installation discovery."""
from __future__ import annotations

import time
from typing import Any

import httpx
import jwt

from app.core.config import settings

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

    app_jwt = create_app_jwt()
    url = f"https://api.github.com/repos/{owner}/{repo}/installation"
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
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        inst_id = data.get("id")
        return str(inst_id) if inst_id is not None else None
