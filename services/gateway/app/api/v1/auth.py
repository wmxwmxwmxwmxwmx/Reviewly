"""Authentication — GitHub OAuth + JWT session."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.db.deps import get_db
from app.db.models import AuthUser
from app.repositories import auth_users as auth_users_repo
from app.services import auth_oauth

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/github/login")
def github_login() -> dict:
    url = auth_oauth.build_github_login_url()
    return {"url": url}


@router.get("/github/callback")
async def github_callback(
    code: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if error:
        return RedirectResponse(
            f"{settings.frontend_url}/login?error={error}",
            status_code=302,
        )
    if not code:
        return RedirectResponse(
            f"{settings.frontend_url}/login?error=missing_code",
            status_code=302,
        )
    result = await auth_oauth.handle_oauth_callback(db, code)
    token = result["token"]
    return RedirectResponse(
        f"{settings.frontend_url}/auth/callback?token={token}",
        status_code=302,
    )


@router.post("/logout")
def logout() -> dict:
    return {"ok": True}


@router.get("/me")
def auth_me(user: AuthUser = Depends(get_current_user)) -> dict:
    return auth_users_repo.user_to_api(user)
