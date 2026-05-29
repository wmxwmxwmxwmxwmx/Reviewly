"""B10: AES-GCM encryption for stored API keys."""
from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _key_bytes() -> bytes:
    raw = settings.settings_encryption_key.strip()
    if not raw:
        raise ValueError("SETTINGS_ENCRYPTION_KEY 未配置")
    if len(raw) == 64:
        return bytes.fromhex(raw)
    return raw.encode("utf-8")[:32].ljust(32, b"\0")


def encrypt_secret(plaintext: str) -> str:
    key = _key_bytes()
    aes = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aes.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_secret(blob: str) -> str:
    key = _key_bytes()
    data = base64.b64decode(blob)
    nonce, ciphertext = data[:12], data[12:]
    return AESGCM(key).decrypt(nonce, ciphertext, None).decode("utf-8")


def mask_secret(secret: str) -> str:
    if len(secret) <= 8:
        return "****"
    return f"{secret[:3]}****{secret[-4:]}"


def is_configured() -> bool:
    return bool(settings.settings_encryption_key.strip())


def encrypt_secrets_json(secrets: dict[str, str]) -> str:
    import json

    return encrypt_secret(json.dumps(secrets))
