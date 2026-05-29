"""Extract persisted AI-generated content from JSON blobs."""
from __future__ import annotations

from typing import Any


def extract_ai_persisted(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    content = raw.get("content")
    if not content:
        return None
    out: dict[str, Any] = {
        "content": str(content),
        "analyzedAt": str(raw.get("analyzedAt") or ""),
    }
    if raw.get("model"):
        out["model"] = str(raw["model"])
    if raw.get("provider"):
        out["provider"] = str(raw["provider"])
    return out


def extract_from_payload(payload: dict | None, key: str) -> dict[str, Any] | None:
    if not payload:
        return None
    return extract_ai_persisted(payload.get(key))


def extract_from_settings(settings: dict | None, key: str) -> dict[str, Any] | None:
    if not settings:
        return None
    return extract_ai_persisted(settings.get(key))
