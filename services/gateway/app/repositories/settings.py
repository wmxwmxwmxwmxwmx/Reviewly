from __future__ import annotations

from copy import deepcopy

from sqlalchemy.orm import Session

from app.db.models import Setting
from app.services import settings_crypto


def get_settings(session: Session) -> dict:
    row = session.get(Setting, "default")
    if row is None:
        from app.mock import seed

        return seed.get_settings()
    return _public_settings(row)


def patch_settings(session: Session, patch: dict) -> dict:
    row = session.get(Setting, "default")
    if row is None:
        from app.mock import seed

        data = seed.get_settings()
        row = Setting(id="default", data=data, encrypted_secrets=None)
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
