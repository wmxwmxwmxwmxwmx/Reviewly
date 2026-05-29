import time

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.ai.anthropic import call_anthropic
from app.ai.openai_compatible import call_openai_compatible
from app.ai.providers import VALID_PROVIDERS, get_endpoint
from app.core.errors import api_error

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequestBody(BaseModel):
    provider: str
    model: str
    api_key: str = Field(validation_alias="apiKey")
    messages: list[ChatMessage]
    temperature: float | None = None
    custom_endpoint: str | None = Field(default=None, validation_alias="customEndpoint")

    model_config = {"populate_by_name": True}


@router.post("/chat")
async def chat(body: ChatRequestBody) -> dict:
    if body.provider not in VALID_PROVIDERS:
        raise api_error("请选择有效的模型供应商")

    if not body.model.strip():
        raise api_error("请填写模型名称")

    if not body.api_key.strip():
        raise api_error("请先在系统设置中填写 API Key")

    if not body.messages:
        raise api_error("缺少待发送的消息内容")

    messages = [m.model_dump() for m in body.messages]
    temperature = body.temperature if body.temperature is not None else 0.2
    started = time.time()

    try:
        if body.provider == "anthropic":
            result = await call_anthropic(
                model=body.model.strip(),
                api_key=body.api_key.strip(),
                messages=messages,
                temperature=temperature,
            )
        else:
            endpoint = get_endpoint(body.provider, body.custom_endpoint)
            result = await call_openai_compatible(
                endpoint=endpoint or "",
                provider=body.provider,
                model=body.model.strip(),
                api_key=body.api_key.strip(),
                messages=messages,
                temperature=temperature,
            )
    except RuntimeError as exc:
        raise api_error(str(exc), 500) from exc

    return {
        "provider": body.provider,
        "model": body.model.strip(),
        "content": result["content"],
        "usage": result["usage"],
        "latencyMs": int((time.time() - started) * 1000),
    }
