"""Fetch account balance / remaining credit from AI provider APIs."""
from __future__ import annotations

from typing import Any

import httpx

from app.ai.providers import get_endpoint

BALANCE_TIMEOUT_SECONDS = 8.0


def _format_amount(amount: float | int | str, currency: str) -> str:
    try:
        value = float(amount)
    except (TypeError, ValueError):
        return str(amount)
    if currency.upper() in ("CNY", "RMB", "¥"):
        return f"¥{value:,.2f}"
    if currency.upper() == "USD":
        return f"${value:,.2f}"
    return f"{value:,.2f} {currency}"


async def fetch_provider_balance(
    *,
    provider: str,
    api_key: str,
    base_url: str | None = None,
) -> dict[str, Any]:
    api_key = (api_key or "").strip()
    if not api_key:
        return {"available": False, "message": "未配置 API Key"}

    try:
        if provider == "deepseek":
            return await _fetch_deepseek_balance(api_key)
        if provider == "openrouter":
            return await _fetch_openrouter_balance(api_key)
        if provider == "openai":
            return await _fetch_openai_balance(api_key)
        if provider == "custom":
            return await _fetch_openai_compatible_balance(api_key, base_url)
        return {"available": False, "message": "该供应商暂不支持余额查询"}
    except httpx.TimeoutException:
        return {"available": False, "message": "余额查询超时"}
    except httpx.ConnectError:
        return {"available": False, "message": "无法连接供应商"}
    except Exception as exc:  # noqa: BLE001
        return {"available": False, "message": str(exc) or "余额查询失败"}


async def _fetch_deepseek_balance(api_key: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=BALANCE_TIMEOUT_SECONDS) as client:
        response = await client.get(
            "https://api.deepseek.com/user/balance",
            headers={"Authorization": f"Bearer {api_key}"},
        )
    data = response.json() if response.content else {}
    if response.status_code == 401:
        return {"available": False, "message": "API Key 无效"}
    if not response.is_success:
        message = data.get("message") or data.get("error") or f"DeepSeek 返回 {response.status_code}"
        return {"available": False, "message": str(message)}

    infos = data.get("balance_infos") or []
    if not infos:
        return {"available": False, "message": "未返回余额信息"}

    primary = infos[0] if isinstance(infos[0], dict) else {}
    currency = str(primary.get("currency") or "CNY")
    total = primary.get("total_balance") or primary.get("top_up_balance") or "0"
    return {
        "available": True,
        "amount": _format_amount(total, currency),
        "currency": currency,
        "raw": total,
    }


async def _fetch_openrouter_balance(api_key: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=BALANCE_TIMEOUT_SECONDS) as client:
        response = await client.get(
            "https://openrouter.ai/api/v1/auth/key",
            headers={"Authorization": f"Bearer {api_key}"},
        )
    data = response.json() if response.content else {}
    if response.status_code == 401:
        return {"available": False, "message": "API Key 无效"}
    if not response.is_success:
        return {"available": False, "message": f"OpenRouter 返回 {response.status_code}"}

    payload = data.get("data") if isinstance(data.get("data"), dict) else data
    remaining = payload.get("limit_remaining")
    if remaining is None:
        return {"available": False, "message": "未返回剩余额度"}

    return {
        "available": True,
        "amount": f"${float(remaining):,.2f}",
        "currency": "USD",
        "raw": remaining,
    }


async def _fetch_openai_balance(api_key: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=BALANCE_TIMEOUT_SECONDS) as client:
        response = await client.get(
            "https://api.openai.com/v1/organization/costs",
            headers={"Authorization": f"Bearer {api_key}"},
            params={"start_time": 0, "limit": 1},
        )
    if response.status_code in (401, 403):
        return {"available": False, "message": "API Key 无余额权限"}
    if response.status_code == 404:
        return {"available": False, "message": "OpenAI 余额接口不可用"}
    if not response.is_success:
        return {"available": False, "message": "OpenAI 暂不支持余额查询"}

    return {"available": False, "message": "OpenAI 请在控制台查看余额"}


async def _fetch_openai_compatible_balance(api_key: str, base_url: str | None) -> dict[str, Any]:
    endpoint = get_endpoint("custom", base_url)
    if not endpoint:
        return {"available": False, "message": "未配置 API Base URL"}

    root = endpoint.replace("/chat/completions", "").rstrip("/")
    candidates = [
        f"{root}/user/balance",
        f"{root}/balance",
        f"{root}/v1/user/balance",
    ]

    async with httpx.AsyncClient(timeout=BALANCE_TIMEOUT_SECONDS) as client:
        for url in candidates:
            try:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {api_key}"},
                )
            except httpx.RequestError:
                continue
            if response.status_code == 404:
                continue
            data = response.json() if response.content else {}
            if response.status_code == 401:
                return {"available": False, "message": "API Key 无效"}
            if not response.is_success:
                continue

            infos = data.get("balance_infos")
            if isinstance(infos, list) and infos and isinstance(infos[0], dict):
                primary = infos[0]
                currency = str(primary.get("currency") or "CNY")
                total = primary.get("total_balance") or primary.get("top_up_balance") or "0"
                return {
                    "available": True,
                    "amount": _format_amount(total, currency),
                    "currency": currency,
                    "raw": total,
                }

            for key in ("balance", "total_balance", "credit", "remaining"):
                if key in data and data[key] is not None:
                    currency = str(data.get("currency") or "CNY")
                    return {
                        "available": True,
                        "amount": _format_amount(data[key], currency),
                        "currency": currency,
                        "raw": data[key],
                    }

    return {"available": False, "message": "该端点暂不支持余额查询"}
