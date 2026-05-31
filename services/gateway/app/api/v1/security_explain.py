"""Security finding AI explain (SSE, on-demand only)."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.repositories import security as security_repo
from app.services import security_explain

router = APIRouter(prefix="/api/security/findings", tags=["security"])


class ExplainBody(BaseModel):
    stream: bool = True


@router.post("/{finding_id}/explain")
async def explain_finding(
    finding_id: str,
    request: Request,
    body: ExplainBody | None = None,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    _ = body
    ctx = security_repo.get_finding_with_context(db, finding_id)
    if not ctx:
        from app.core.errors import api_error

        raise api_error("安全发现不存在", 404)
    from app.services.ai_config import resolve_ai_config

    resolve_ai_config(db)

    async def event_stream():
        try:
            async for delta in security_explain.stream_finding_explanation(db, finding_id):
                if await request.is_disconnected():
                    break
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
