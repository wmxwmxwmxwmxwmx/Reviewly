"""B3–B10 routes — GitHub, domain APIs, settings integration."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.db.deps import get_db
from app.mock import seed
from app.repositories import settings as settings_repo
from app.services import settings_crypto
from app.services.integration_test import run_integration_test

router = APIRouter(prefix="/api", tags=["placeholders"])


@router.get("/integrations/github/install-url")
def github_install_url() -> dict:
    slug = settings.github_app_slug
    return {
        "url": f"https://github.com/apps/{slug}/installations/new",
        "status": "ok" if settings.github_app_id else "placeholder",
    }


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
