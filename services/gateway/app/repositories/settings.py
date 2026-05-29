from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.db.models import Setting
from app.repositories.ai_persisted import extract_ai_persisted
from app.services import settings_crypto


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _default_settings() -> dict:
    return {
        "ai": {
            "provider": "openai",
            "model": "",
            "temperature": 0.2,
            "maxTokens": 4096,
        },
        "github": {"connected": False},
        "notifications": {"email": True, "slack": False},
        "dashboard": {},
    }


def get_settings(session: Session) -> dict:
    row = session.get(Setting, "default")
    if row is None:
        return _default_settings()
    return _public_settings(row)


def patch_settings(session: Session, patch: dict) -> dict:
    row = session.get(Setting, "default")
    if row is None:
        row = Setting(id="default", data=_default_settings(), encrypted_secrets=None)
        session.add(row)

    data = deepcopy(row.data)
    secrets_patch = patch.pop("secrets", None)

    ai_patch = patch.get("ai")
    if isinstance(ai_patch, dict) and ai_patch.get("apiKey"):
        provider = ai_patch.get("provider") or data.get("ai", {}).get("provider", "openai")
        if secrets_patch is None:
            secrets_patch = {}
        secrets_patch[str(provider)] = str(ai_patch.pop("apiKey"))

    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(data.get(key), dict):
            data[key].update(value)
        else:
            data[key] = value

    row.data = data

    if secrets_patch and not settings_crypto.is_configured():
        raise api_error("请先配置 SETTINGS_ENCRYPTION_KEY 以保存 API 密钥", 501)

    if secrets_patch and settings_crypto.is_configured():
        existing = _decrypt_secrets(row.encrypted_secrets) if row.encrypted_secrets else {}
        existing.update(secrets_patch)
        row.encrypted_secrets = settings_crypto.encrypt_secrets_json(existing)

    session.commit()
    session.refresh(row)
    return _public_settings(row)


def _public_settings(row: Setting) -> dict:
    data = deepcopy(row.data)
    if row.encrypted_secrets and settings_crypto.is_configured():
        secrets = _decrypt_secrets(row.encrypted_secrets)
        masked = {k: settings_crypto.mask_secret(v) for k, v in secrets.items() if v}
        if masked:
            data["secrets"] = masked
    return data


def _decrypt_secrets(blob: str) -> dict:
    import json

    from app.services.settings_crypto import decrypt_secret

    raw = decrypt_secret(blob)
    return json.loads(raw)


def get_decrypted_secrets(session: Session) -> dict[str, str]:
    """Return plaintext API keys from encrypted store; empty dict if unavailable."""
    row = session.get(Setting, "default")
    if row is None or not row.encrypted_secrets or not settings_crypto.is_configured():
        return {}
    try:
        secrets = _decrypt_secrets(row.encrypted_secrets)
        return {k: v for k, v in secrets.items() if isinstance(v, str) and v.strip()}
    except Exception:
        return {}


def get_dashboard_weekly_summary(session: Session) -> dict | None:
    row = session.get(Setting, "default")
    if row is None:
        return None
    dashboard = (row.data or {}).get("dashboard") or {}
    return extract_ai_persisted(dashboard.get("weeklySummary"))


def save_dashboard_weekly_summary(
    session: Session,
    *,
    content: str,
    model: str | None = None,
    provider: str | None = None,
) -> dict:
    row = session.get(Setting, "default")
    if row is None:
        row = Setting(id="default", data=_default_settings(), encrypted_secrets=None)
        session.add(row)

    data = deepcopy(row.data)
    dashboard = dict(data.get("dashboard") or {})
    blob: dict = {"content": content, "analyzedAt": _now_iso()}
    if model:
        blob["model"] = model
    if provider:
        blob["provider"] = provider
    dashboard["weeklySummary"] = blob
    data["dashboard"] = dashboard
    row.data = data
    session.flush()
    return blob


def rotate_secrets(session: Session) -> dict[str, int]:
    """Re-encrypt stored secrets with current SETTINGS_ENCRYPTION_KEY (validates round-trip)."""
    row = session.get(Setting, "default")
    if row is None or not row.encrypted_secrets:
        return {"rotated": 0}
    if not settings_crypto.is_configured():
        raise ValueError("SETTINGS_ENCRYPTION_KEY 未配置")

    secrets = _decrypt_secrets(row.encrypted_secrets)
    row.encrypted_secrets = settings_crypto.encrypt_secrets_json(secrets)
    session.commit()
    return {"rotated": len(secrets)}
