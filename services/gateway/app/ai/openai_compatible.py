import httpx

from app.ai.providers import normalize_openai_usage


async def call_openai_compatible(
    *,
    endpoint: str,
    provider: str,
    model: str,
    api_key: str,
    messages: list[dict],
    temperature: float = 0.2,
) -> dict:
    if not endpoint:
        raise RuntimeError("Custom provider 需要配置 customEndpoint")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    if provider == "openrouter":
        headers["HTTP-Referer"] = "http://localhost:3000"
        headers["X-Title"] = "PRism"

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            endpoint,
            headers=headers,
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
            },
        )

    data = response.json() if response.content else {}
    if not response.is_success:
        err = data.get("error", {}) if isinstance(data.get("error"), dict) else {}
        message = err.get("message") or data.get("message") or f"模型接口请求失败：{response.status_code}"
        raise RuntimeError(message)

    choices = data.get("choices") or []
    content = ""
    if choices and isinstance(choices[0], dict):
        content = (choices[0].get("message") or {}).get("content") or ""

    return {
        "content": content,
        "usage": normalize_openai_usage(data.get("usage")),
    }
