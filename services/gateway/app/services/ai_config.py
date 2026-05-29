"""Shared AI provider/model/key resolution from persisted settings."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.ai.providers import VALID_PROVIDERS
from app.core.errors import api_error
from app.repositories import settings as settings_repo


def resolve_ai_config(
    session: Session,
    *,
    api_key_override: str | None = None,
    require_db_key: bool = True,
) -> tuple[str, str, str, str | None]:
    """Return (provider, model, api_key, custom_endpoint)."""
    cfg = settings_repo.get_settings(session)
    ai = cfg.get("ai", {})
    provider = str(ai.get("provider", "")).strip()
    model = str(ai.get("model", "")).strip()
    custom_endpoint = ai.get("customEndpoint")

    if not provider or provider == "none":
        raise api_error("请先在系统设置中配置 AI 供应商", 400)
    if provider not in VALID_PROVIDERS:
        raise api_error("无效的 AI 供应商", 400)
    if not model:
        raise api_error("请配置模型名称", 400)

    secrets = settings_repo.get_decrypted_secrets(session)
    api_key = (
        secrets.get(provider, "").strip()
        or (api_key_override or "").strip()
    )
    if require_db_key and not api_key:
        raise api_error("请先在系统设置中填写 API Key（PATCH /api/settings）", 400)
    if not api_key:
        raise api_error("请先在系统设置中配置 API Key", 400)

    return provider, model, api_key, custom_endpoint
