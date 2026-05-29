"""GitHub webhook verification and dispatch (B3)."""
from __future__ import annotations

import hashlib
import hmac
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.github import sync


def _github_configured() -> bool:
    return bool(settings.github_app_id and settings.github_app_private_key)


def verify_signature(body: bytes, signature_header: str | None) -> bool:
    secret = settings.github_webhook_secret
    if not secret:
        return settings.debug
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)


async def handle_event(session: Session, event: str, payload: dict[str, Any]) -> None:
    if event == "installation":
        action = payload.get("action")
        installation = payload.get("installation", {})
        account = payload.get("sender", {}) or installation.get("account", {})
        inst_id = installation.get("id")
        if not inst_id:
            return
        inst_str = str(inst_id)
        if action in ("created", "added"):
            sync.record_installation(
                session,
                inst_str,
                account.get("login", "unknown"),
            )
            if _github_configured():
                await sync.sync_installation(session, inst_str)
            return
        if action == "deleted":
            return
        if _github_configured():
            await sync.sync_installation(session, inst_str)
        return

    if event == "pull_request":
        installation_id = payload.get("installation", {}).get("id")
        if installation_id and _github_configured():
            await sync.sync_installation(session, str(installation_id))
