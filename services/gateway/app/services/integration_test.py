"""B10: test AI provider connectivity."""
from __future__ import annotations

import httpx
from sqlalchemy.orm import Session

from app.ai.providers import get_endpoint
from app.repositories import settings as settings_repo


async def run_integration_test(session: Session) -> dict:
    cfg = settings_repo.get_settings(session)
    ai_cfg = cfg.get("ai", {})
    provider = str(ai_cfg.get("provider", "")).strip()
    if not provider:
        return {"ok": False, "message": "未配置 AI 供应商"}

    secrets = settings_repo.get_decrypted_secrets(session)
    api_key = secrets.get(provider) or secrets.get("apiKey", "")
    if not api_key:
        return {"ok": False, "message": "未配置 API Key（请 PATCH settings 的 ai.apiKey 或 secrets）"}

    try:
        if provider == "anthropic":
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                    },
                )
                if resp.status_code < 400:
                    return {"ok": True, "message": f"Anthropic 连接成功 ({resp.status_code})"}
                return {"ok": False, "message": f"Anthropic 返回 {resp.status_code}"}

        endpoint = get_endpoint(provider, ai_cfg.get("customEndpoint"))
        if not endpoint:
            return {"ok": False, "message": "无法解析供应商 endpoint"}

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                endpoint.replace("/chat/completions", "/models"),
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code < 400:
                return {"ok": True, "message": f"{provider} 连接成功 ({resp.status_code})"}
            if resp.status_code == 404:
                return {"ok": True, "message": f"{provider} 端点可达（models 404 可接受）"}
            return {"ok": False, "message": f"{provider} 返回 {resp.status_code}"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "message": f"连接失败: {exc}"}
