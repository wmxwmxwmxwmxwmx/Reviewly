"""Architecture scan and on-demand AI analysis."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.repositories import architecture as architecture_repo
from app.services import architecture_analyze as architecture_analyze_service
from app.services import architecture_scan as architecture_scan_service

router = APIRouter(prefix="/api/architecture", tags=["architecture"])


def _sse_error_message(exc: Exception) -> str:
    if isinstance(exc, HTTPException):
        detail = exc.detail
        if isinstance(detail, dict) and detail.get("error"):
            return str(detail["error"])
        return str(detail)
    return str(exc)


class ScanBody(BaseModel):
    repo_id: str = Field(validation_alias="repoId")
    stream: bool = False

    model_config = {"populate_by_name": True}


class AnalyzeBody(BaseModel):
    stream: bool = True


@router.post("/scan")
async def scan_repository(body: ScanBody, request: Request, db: Session = Depends(get_db)):
    if body.stream:

        async def event_stream():
            try:
                async for event in architecture_scan_service.stream_run_scan(db, body.repo_id):
                    if await request.is_disconnected():
                        break
                    payload = json.dumps(event, ensure_ascii=False)
                    yield f"data: {payload}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as exc:  # noqa: BLE001
                yield f"data: {json.dumps({'error': _sse_error_message(exc)}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return await architecture_scan_service.run_scan(db, body.repo_id)


@router.get("/repos/{repo_id}/graph")
def architecture_graph(repo_id: str, db: Session = Depends(get_db)) -> dict:
    graph = architecture_repo.get_dependency_graph(db, repo_id)
    graph.setdefault("status", "ok")
    return graph


@router.post("/repos/{repo_id}/analyze")
async def architecture_analyze(
    repo_id: str,
    request: Request,
    body: AnalyzeBody | None = None,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    _ = body

    async def event_stream():
        try:
            async for delta in architecture_analyze_service.stream_architecture_analysis(
                db, repo_id
            ):
                if await request.is_disconnected():
                    break
                payload = json.dumps({"delta": delta}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'error': _sse_error_message(exc)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
