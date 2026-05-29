"""B3–B10 routes — GitHub, domain APIs, settings integration."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.db.deps import get_db
from app.github import webhooks
from app.mock import seed
from app.repositories import settings as settings_repo
from app.services import settings_crypto
from app.services.integration_test import run_integration_test

router = APIRouter(prefix="/api", tags=["placeholders"])


@router.get("/integrations/github/install-url")
def github_install_url() -> dict:
    slug = settings.github_app_slug
    app_configured = bool((settings.github_app_id or "").strip())
    pat_configured = bool((settings.github_pat or "").strip())
    connected = app_configured or pat_configured
    host_label: str | None = None
    if app_configured and slug:
        host_label = f"github.com/apps/{slug}"
    elif pat_configured:
        host_label = "api.github.com"
    return {
        "url": f"https://github.com/apps/{slug}/installations/new",
        "status": "ok" if app_configured else "placeholder",
        "connected": connected,
        "hostLabel": host_label,
    }


@router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
    x_github_event: str | None = Header(default=None, alias="X-GitHub-Event"),
) -> dict:
    body = await request.body()
    if settings.github_webhook_secret and not webhooks.verify_signature(body, x_hub_signature_256):
        raise api_error("Webhook 签名无效", 401)

    payload = json.loads(body.decode("utf-8") or "{}")
    event = x_github_event or "unknown"
    await webhooks.handle_event(db, event, payload)
    return {"ok": True, "event": event}


@router.post("/settings/test-integration")
async def test_integration(db: Session = Depends(get_db)) -> dict:
    return await run_integration_test(db)


@router.post("/settings/rotate-secret")
def rotate_secret(db: Session = Depends(get_db)) -> dict:
    if not settings_crypto.is_configured():
        raise api_error("请先配置 SETTINGS_ENCRYPTION_KEY", 501)
    try:
        result = settings_repo.rotate_secrets(db)
    except ValueError as exc:
        raise api_error(str(exc), 501) from exc
    return {
        "ok": True,
        "rotated": result["rotated"],
        "message": f"已重新加密 {result['rotated']} 条密钥",
    }
