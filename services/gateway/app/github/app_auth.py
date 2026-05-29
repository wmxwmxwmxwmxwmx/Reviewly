"""GitHub App JWT + installation token (B3)."""
from __future__ import annotations

import time
from typing import Any

import httpx
import jwt

from app.core.config import settings

_token_cache: dict[str, tuple[str, float]] = {}


def _normalize_private_key(pem: str) -> str:
    return pem.replace("\\n", "\n").strip()


def create_app_jwt() -> str:
    if not settings.github_app_id or not settings.github_app_private_key:
        raise RuntimeError("GitHub App 凭据未配置")

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


async def get_installation_token(installation_id: str) -> str:
    cached = _token_cache.get(installation_id)
    if cached and cached[1] > time.time() + 60:
        return cached[0]

    app_jwt = create_app_jwt()
    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
            },
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

    token = data["token"]
    expires_at = data.get("expires_at")
    expiry_ts = time.time() + 3600
    if expires_at:
        from datetime import datetime

        expiry_ts = datetime.fromisoformat(expires_at.replace("Z", "+00:00")).timestamp()

    _token_cache[installation_id] = (token, expiry_ts)
    return token
