from collections.abc import AsyncIterator

import httpx

from app.ai.providers import PROVIDER_ENDPOINTS, normalize_anthropic_usage


async def call_anthropic(
    *,
    model: str,
    api_key: str,
    messages: list[dict],
    temperature: float = 0.2,
    max_tokens: int | None = None,
) -> dict:
    system = next((m["content"] for m in messages if m.get("role") == "system"), None)
    chat_messages = [
        {
            "role": "assistant" if m["role"] == "assistant" else "user",
            "content": m["content"],
        }
        for m in messages
        if m.get("role") != "system"
    ]

    body: dict = {
        "model": model,
        "max_tokens": max_tokens if max_tokens is not None else 1600,
        "temperature": temperature,
        "messages": chat_messages,
    }
    if system:
        body["system"] = system

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            PROVIDER_ENDPOINTS["anthropic"],
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            json=body,
        )

    data = response.json() if response.content else {}
    if not response.is_success:
        err = data.get("error", {}) if isinstance(data.get("error"), dict) else {}
        message = err.get("message") or data.get("message") or f"Anthropic 请求失败：{response.status_code}"
        raise RuntimeError(message)

    content_parts = data.get("content") or []
    content = "\n".join(part.get("text", "") for part in content_parts if isinstance(part, dict))

    return {
        "content": content,
        "usage": normalize_anthropic_usage(data.get("usage")),
    }


async def stream_anthropic(
    *,
    model: str,
    api_key: str,
    messages: list[dict],
    temperature: float = 0.2,
    max_tokens: int | None = None,
) -> AsyncIterator[str | dict[str, dict[str, int]]]:
    system = next((m["content"] for m in messages if m.get("role") == "system"), None)
    chat_messages = [
        {
            "role": "assistant" if m["role"] == "assistant" else "user",
            "content": m["content"],
        }
        for m in messages
        if m.get("role") != "system"
    ]

    body: dict = {
        "model": model,
        "max_tokens": max_tokens if max_tokens is not None else 1600,
        "temperature": temperature,
        "messages": chat_messages,
        "stream": True,
    }
    if system:
        body["system"] = system

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            PROVIDER_ENDPOINTS["anthropic"],
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            json=body,
        ) as response:
            if not response.is_success:
                body_bytes = await response.aread()
                raise RuntimeError(body_bytes.decode("utf-8", errors="replace")[:500])

            input_tokens = 0
            output_tokens = 0

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                import json

                try:
                    data = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
                event_type = data.get("type")
                if event_type == "message_start":
                    message = data.get("message") or {}
                    usage = message.get("usage") or {}
                    input_tokens = int(usage.get("input_tokens") or 0)
                elif event_type == "content_block_delta":
                    delta = data.get("delta") or {}
                    text = delta.get("text") or ""
                    if text:
                        yield text
                elif event_type == "message_delta":
                    usage = data.get("usage") or {}
                    output_tokens = int(usage.get("output_tokens") or output_tokens)

            yield {
                "usage": normalize_anthropic_usage(
                    {"input_tokens": input_tokens, "output_tokens": output_tokens},
                ),
            }
