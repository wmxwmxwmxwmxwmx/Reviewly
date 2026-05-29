PROVIDER_ENDPOINTS = {
    "openai": "https://api.openai.com/v1/chat/completions",
    "deepseek": "https://api.deepseek.com/chat/completions",
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
    "google": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    "anthropic": "https://api.anthropic.com/v1/messages",
    "custom": "",
}

VALID_PROVIDERS = frozenset(PROVIDER_ENDPOINTS.keys())


def get_endpoint(provider: str, custom_endpoint: str | None = None) -> str | None:
    if provider == "custom":
        return (custom_endpoint or "").strip() or None
    return PROVIDER_ENDPOINTS.get(provider)


def normalize_openai_usage(usage: dict | None) -> dict[str, int]:
    if not usage:
        return {"promptTokens": 0, "completionTokens": 0, "totalTokens": 0}
    prompt = usage.get("prompt_tokens", 0) or 0
    completion = usage.get("completion_tokens", 0) or 0
    total = usage.get("total_tokens", prompt + completion) or (prompt + completion)
    return {"promptTokens": prompt, "completionTokens": completion, "totalTokens": total}


def normalize_anthropic_usage(usage: dict | None) -> dict[str, int]:
    if not usage:
        return {"promptTokens": 0, "completionTokens": 0, "totalTokens": 0}
    prompt = usage.get("input_tokens", 0) or 0
    completion = usage.get("output_tokens", 0) or 0
    return {
        "promptTokens": prompt,
        "completionTokens": completion,
        "totalTokens": prompt + completion,
    }
