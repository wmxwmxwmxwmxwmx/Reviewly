"""Validate AI model configuration by issuing a minimal live request."""
from __future__ import annotations

import time
from typing import Any

import httpx

from app.ai.providers import PROVIDER_ENDPOINTS, VALID_PROVIDERS, get_endpoint

VALIDATION_TIMEOUT_SECONDS = 10.0

ERROR_INVALID_API_KEY = "invalid_api_key"
ERROR_MODEL_NOT_FOUND = "model_not_found"
ERROR_CONNECTION_FAILED = "connection_failed"
ERROR_TIMEOUT = "timeout"
ERROR_SERVER_ERROR = "server_error"
ERROR_INVALID_REQUEST = "invalid_request"


def _resolve_chat_endpoint(provider: str, base_url: str | None) -> str | None:
    trimmed = (base_url or "").strip()
    if trimmed:
        normalized = trimmed.rstrip("/")
        if normalized.endswith("/chat/completions"):
            return normalized
        if normalized.endswith("/v1"):
            return f"{normalized}/chat/completions"
        return f"{normalized}/chat/completions"
    return get_endpoint(provider, None)


def _provider_label(provider: str) -> str:
    labels = {
        "openai": "OpenAI",
        "anthropic": "Anthropic",
        "google": "Google",
        "deepseek": "DeepSeek",
        "openrouter": "OpenRouter",
        "custom": "OpenAI Compatible",
    }
    return labels.get(provider, provider)


def _format_context_window(value: int | None) -> str | None:
    if value is None or value <= 0:
        return None
    if value >= 1_000_000:
        millions = value / 1_000_000
        return f"{int(millions)}M" if millions.is_integer() else f"{millions:.1f}M"
    if value >= 1_000:
        thousands = value / 1_000
        return f"{int(thousands)}K" if thousands.is_integer() else f"{thousands:.1f}K"
    return str(value)


def _extract_context_window(data: dict[str, Any]) -> str | None:
    model_info = data.get("model") if isinstance(data.get("model"), dict) else {}
    for key in ("context_window", "contextWindow", "max_context_tokens", "maxContextTokens"):
        raw = data.get(key) or model_info.get(key)
        if isinstance(raw, int) and raw > 0:
            return _format_context_window(raw)
    usage = data.get("usage") if isinstance(data.get("usage"), dict) else {}
    for key in ("total_tokens", "prompt_tokens"):
        raw = usage.get(key)
        if isinstance(raw, int) and raw > 0:
            break
    return None


def _classify_http_error(status_code: int) -> tuple[str, str]:
    if status_code == 401:
        return ERROR_INVALID_API_KEY, "API Key 无效或已失效"
    if status_code == 404:
        return ERROR_MODEL_NOT_FOUND, "模型名称不存在，请检查模型名称配置"
    if status_code >= 500:
        return ERROR_SERVER_ERROR, "服务端返回异常，请稍后重试"
    return ERROR_INVALID_REQUEST, f"模型服务返回 {status_code}"


def _classify_exception(exc: Exception) -> tuple[str, str]:
    if isinstance(exc, httpx.TimeoutException):
        return ERROR_TIMEOUT, "请求超时（10秒），请检查网络连接"
    if isinstance(exc, httpx.ConnectError):
        return ERROR_CONNECTION_FAILED, "无法连接到服务地址，请检查 API Base URL"
    if isinstance(exc, httpx.RequestError):
        return ERROR_CONNECTION_FAILED, "无法连接到服务地址，请检查 API Base URL"
    return ERROR_INVALID_REQUEST, str(exc) or "验证失败"


async def validate_model_config(
    *,
    provider: str,
    model: str,
    api_key: str,
    base_url: str | None = None,
) -> dict[str, Any]:
    provider = (provider or "").strip()
    model = (model or "").strip()
    api_key = (api_key or "").strip()

    if provider not in VALID_PROVIDERS:
        return {
            "success": False,
            "errorType": ERROR_INVALID_REQUEST,
            "message": "无效的 AI 供应商",
        }
    if not model:
        return {
            "success": False,
            "errorType": ERROR_INVALID_REQUEST,
            "message": "请填写模型名称",
        }
    if not api_key:
        return {
            "success": False,
            "errorType": ERROR_INVALID_API_KEY,
            "message": "请填写 API Key",
        }

    started = time.perf_counter()

    try:
        if provider == "anthropic":
            result = await _validate_anthropic(model=model, api_key=api_key)
        else:
            endpoint = _resolve_chat_endpoint(provider, base_url)
            if not endpoint:
                return {
                    "success": False,
                    "errorType": ERROR_INVALID_REQUEST,
                    "message": "请配置 API Base URL",
                }
            result = await _validate_openai_compatible(
                endpoint=endpoint,
                provider=provider,
                model=model,
                api_key=api_key,
            )
    except Exception as exc:  # noqa: BLE001
        error_type, message = _classify_exception(exc)
        return {
            "success": False,
            "errorType": error_type,
            "message": message,
        }

    latency_ms = int((time.perf_counter() - started) * 1000)

    if not result.get("success"):
        return {
            "success": False,
            "errorType": result.get("errorType", ERROR_INVALID_REQUEST),
            "message": result.get("message", "验证失败"),
            "latency": latency_ms,
        }

    resolved_model = str(result.get("model") or model)
    context_window = result.get("contextWindow")

    return {
        "success": True,
        "latency": latency_ms,
        "model": resolved_model,
        "provider": _provider_label(provider),
        "status": "Available",
        "contextWindow": context_window,
    }


async def _validate_anthropic(*, model: str, api_key: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=VALIDATION_TIMEOUT_SECONDS) as client:
        response = await client.post(
            PROVIDER_ENDPOINTS["anthropic"],
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            json={
                "model": model,
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "ping"}],
            },
        )

    data = response.json() if response.content else {}
    if response.status_code != 200:
        error_type, message = _classify_http_error(response.status_code)
        err = data.get("error", {}) if isinstance(data.get("error"), dict) else {}
        detail = err.get("message") or data.get("message")
        if detail and error_type == ERROR_INVALID_REQUEST:
            message = str(detail)
        return {"success": False, "errorType": error_type, "message": message}

    content = data.get("content")
    if not isinstance(content, list) or not content:
        return {
            "success": False,
            "errorType": ERROR_INVALID_REQUEST,
            "message": "模型响应格式异常",
        }

    return {
        "success": True,
        "model": data.get("model") or model,
        "contextWindow": _extract_context_window(data),
    }


async def _validate_openai_compatible(
    *,
    endpoint: str,
    provider: str,
    model: str,
    api_key: str,
) -> dict[str, Any]:
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    if provider == "openrouter":
        headers["HTTP-Referer"] = "http://localhost:3000"
        headers["X-Title"] = "PRism"

    async with httpx.AsyncClient(timeout=VALIDATION_TIMEOUT_SECONDS) as client:
        response = await client.post(
            endpoint,
            headers=headers,
            json={
                "model": model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1,
            },
        )

    data = response.json() if response.content else {}
    if response.status_code != 200:
        error_type, message = _classify_http_error(response.status_code)
        err = data.get("error", {}) if isinstance(data.get("error"), dict) else {}
        detail = err.get("message") or data.get("message")
        if detail:
            lowered = str(detail).lower()
            if "model" in lowered and ("not found" in lowered or "does not exist" in lowered):
                error_type, message = ERROR_MODEL_NOT_FOUND, "模型名称不存在，请检查模型名称配置"
            elif error_type == ERROR_INVALID_REQUEST:
                message = str(detail)
        return {"success": False, "errorType": error_type, "message": message}

    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        return {
            "success": False,
            "errorType": ERROR_INVALID_REQUEST,
            "message": "模型响应格式异常",
        }

    return {
        "success": True,
        "model": data.get("model") or model,
        "contextWindow": _extract_context_window(data),
    }
