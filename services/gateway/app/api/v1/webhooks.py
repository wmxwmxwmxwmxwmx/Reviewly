"""GitHub webhook ingress."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.db.deps import get_db
from app.github import webhooks

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/github")
async def github_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
    x_github_event: str | None = Header(default=None, alias="X-GitHub-Event"),
) -> dict:
    body = await request.body()
    if settings.github_webhook_secret and not webhooks.verify_signature(body, x_hub_signature_256):
        raise api_error("Invalid webhook signature", 401)

    payload = json.loads(body.decode("utf-8") or "{}")
    event = x_github_event or "unknown"
    await webhooks.handle_event(db, event, payload)
    return {"ok": True, "event": event}
