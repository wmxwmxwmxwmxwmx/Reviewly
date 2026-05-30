"""Development-only error payloads with full traceback (no business logic changes)."""
from __future__ import annotations

import traceback

from app.core.config import settings


def dev_diagnostics_enabled() -> bool:
    return settings.debug


def dev_error_payload(
    exc: BaseException,
    *,
    error: str = "服务器内部错误",
    context: str | None = None,
) -> dict[str, str]:
    """Build JSON body; traceback fields only when DEBUG is enabled."""
    message = error
    if context:
        message = f"{error} ({context})"
    payload: dict[str, str] = {"error": message}
    if dev_diagnostics_enabled():
        payload["exception"] = f"{type(exc).__name__}: {exc}"
        payload["traceback"] = traceback.format_exc()
    return payload
