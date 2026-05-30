"""Optional LLM calls for analysis pipeline (B4)."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.ai.anthropic import call_anthropic
from app.ai.openai_compatible import call_openai_compatible
from app.ai.providers import VALID_PROVIDERS, get_endpoint

logger = logging.getLogger(__name__)

_VALID_SEVERITIES = frozenset({"critical", "high", "medium", "low"})
_VALID_TYPES = frozenset({"security", "performance"})


async def fetch_optional_review_finding(
    *,
    provider: str,
    model: str,
    api_key: str,
    pull_request_id: str,
    file_paths: list[str],
    custom_endpoint: str | None = None,
) -> list[dict[str, Any]]:
    """Call LLM for an extra finding; returns [] on any failure or invalid response."""
    if provider not in VALID_PROVIDERS or not api_key.strip() or not model.strip():
        return []

    files_hint = ", ".join(file_paths[:5])
    prompt = (
        f"Review pull request {pull_request_id} (files: {files_hint}). "
        "Reply with a single JSON object only, keys: id, type, severity, title, file, line, description. "
        "type must be security or performance. severity: critical|high|medium|low."
    )
    messages = [{"role": "user", "content": prompt}]

    try:
        if provider == "anthropic":
            result = await call_anthropic(
                model=model.strip(),
                api_key=api_key.strip(),
                messages=messages,
                temperature=0.2,
            )
        else:
            endpoint = get_endpoint(provider, custom_endpoint)
            if not endpoint and provider != "custom":
                return []
            result = await call_openai_compatible(
                endpoint=endpoint or "",
                provider=provider,
                model=model.strip(),
                api_key=api_key.strip(),
                messages=messages,
                temperature=0.2,
            )
    except Exception as exc:
        logger.warning("LLM optional finding failed for PR %s: %s", pull_request_id, exc)
        return []

    content = (result.get("content") or "").strip()
    finding = _parse_finding_json(content, file_paths)
    if not finding:
        logger.warning(
            "LLM optional finding parse failed for PR %s (content length=%d)",
            pull_request_id,
            len(content),
        )
    return [finding] if finding else []


def _parse_finding_json(content: str, file_paths: list[str]) -> dict[str, Any] | None:
    match = re.search(r"\{[\s\S]*\}", content)
    if not match:
        return None
    try:
        data = json.loads(match.group())
    except json.JSONDecodeError:
        return None

    if not isinstance(data, dict) or not data.get("title"):
        return None

    severity = str(data.get("severity", "medium")).lower()
    if severity not in _VALID_SEVERITIES:
        severity = "medium"

    finding_type = str(data.get("type", "security")).lower()
    if finding_type not in _VALID_TYPES:
        finding_type = "security"

    default_file = file_paths[0] if file_paths else "unknown"
    return {
        "id": str(data.get("id", "llm-1")),
        "type": finding_type,
        "severity": severity,
        "title": str(data["title"]),
        "description": str(data.get("description", "")),
        "file": str(data.get("file", default_file)),
        "line": int(data.get("line", 0)),
        "confidence": float(data.get("confidence", 75)),
    }
