"""Performance finding AI optimize (SSE, on-demand only)."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.db.deps import get_db
from app.repositories import performance as performance_repo
from app.services import performance_optimize

router = APIRouter(prefix="/api/performance/findings", tags=["performance"])


class OptimizeBody(BaseModel):
    stream: bool = True


@router.post("/{finding_id}/optimize")
async def optimize_finding(
    finding_id: str,
    request: Request,
    body: OptimizeBody | None = None,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    _ = body
    ctx = performance_repo.get_finding_with_context(db, finding_id)
    if not ctx:
        raise api_error("性能发现不存在", 404)
    from app.services.ai_config import resolve_ai_config

    resolve_ai_config(db)

    async def event_stream():
        try:
            async for delta in performance_optimize.stream_finding_optimization(db, finding_id):
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
