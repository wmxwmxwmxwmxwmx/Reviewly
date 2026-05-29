"""GitHub webhook HMAC verification."""
from __future__ import annotations

import hashlib
import hmac

from app.core.config import settings


def verify_signature(body: bytes, signature_header: str | None) -> bool:
    secret = settings.github_webhook_secret
    if not secret:
        return settings.debug
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)
