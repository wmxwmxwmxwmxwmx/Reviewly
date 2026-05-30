import json
import time

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.ai.anthropic import call_anthropic, stream_anthropic
from app.ai.openai_compatible import call_openai_compatible, stream_openai_compatible
from app.ai.providers import VALID_PROVIDERS, get_endpoint
from app.core.errors import api_error
from app.core.security import get_current_user
from app.db.deps import get_db
from app.db.models import AuthUser
from app.services.ai_config import resolve_ai_config
from app.services.ai_usage import log_ai_usage

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequestBody(BaseModel):
    provider: str = ""
    model: str = ""
    api_key: str = Field(default="", validation_alias="apiKey")
    messages: list[ChatMessage]
    temperature: float | None = None
    custom_endpoint: str | None = Field(default=None, validation_alias="customEndpoint")
    stream: bool = False

    model_config = {"populate_by_name": True}


def _resolve_chat_config(session: Session, body: ChatRequestBody) -> tuple[str, str, str, str | None]:
    """Resolve credentials from server settings, with optional client overrides."""
    provider, model, api_key, custom_endpoint = resolve_ai_config(
        session,
        api_key_override=body.api_key.strip() or None,
        require_db_key=False,
    )

    if body.provider.strip() in VALID_PROVIDERS:
        provider = body.provider.strip()
    if body.model.strip():
        model = body.model.strip()
    if body.api_key.strip():
        api_key = body.api_key.strip()
    if body.custom_endpoint:
        custom_endpoint = body.custom_endpoint

    return provider, model, api_key, custom_endpoint


async def _stream_chat(
    *,
    provider: str,
    model: str,
    api_key: str,
    custom_endpoint: str | None,
    messages: list[dict],
    temperature: float,
):
    if provider == "anthropic":
        async for delta in stream_anthropic(
            model=model,
            api_key=api_key,
            messages=messages,
            temperature=temperature,
        ):
            yield delta
    else:
        endpoint = get_endpoint(provider, custom_endpoint)
        async for delta in stream_openai_compatible(
            endpoint=endpoint or "",
            provider=provider,
            model=model,
            api_key=api_key,
            messages=messages,
            temperature=temperature,
        ):
            yield delta


@router.post("/chat")
async def chat(
    body: ChatRequestBody,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    if not body.messages:
        raise api_error("缺少待发送的消息内容")

    provider, model, api_key, custom_endpoint = _resolve_chat_config(db, body)
    messages = [m.model_dump() for m in body.messages]
    temperature = body.temperature if body.temperature is not None else 0.2

    if body.stream:

        async def event_stream():
            try:
                async for delta in _stream_chat(
                    provider=provider,
                    model=model,
                    api_key=api_key,
                    custom_endpoint=custom_endpoint,
                    messages=messages,
                    temperature=temperature,
                ):
                    payload = json.dumps({"delta": delta}, ensure_ascii=False)
                    yield f"data: {payload}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as exc:  # noqa: BLE001
                yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    started = time.time()

    try:
        if provider == "anthropic":
            result = await call_anthropic(
                model=model,
                api_key=api_key,
                messages=messages,
                temperature=temperature,
            )
        else:
            endpoint = get_endpoint(provider, custom_endpoint)
            result = await call_openai_compatible(
                endpoint=endpoint or "",
                provider=provider,
                model=model,
                api_key=api_key,
                messages=messages,
                temperature=temperature,
            )
    except RuntimeError as exc:
        raise api_error(str(exc), 500) from exc

    latency_ms = int((time.time() - started) * 1000)
    log_ai_usage(
        db,
        user_id=user.id,
        feature="chat",
        provider=provider,
        model=model,
        usage=result.get("usage"),
        stream=False,
        latency_ms=latency_ms,
    )
    db.commit()

    return {
        "provider": provider,
        "model": model,
        "content": result["content"],
        "usage": result["usage"],
        "latencyMs": latency_ms,
    }
