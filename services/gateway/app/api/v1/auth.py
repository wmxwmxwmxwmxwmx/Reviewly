"""Authentication — GitHub OAuth + JWT session."""
from __future__ import annotations

from urllib.parse import quote

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


@router.get("/status")
def auth_status() -> dict:
    """Login page: whether GitHub OAuth is ready and if dev bypass is on."""
    return {
        "githubOAuthConfigured": auth_oauth.is_oauth_configured(),
        "authBypassEnabled": settings.prism_auth_bypass,
        "oauthCallbackUrl": settings.oauth_callback_url,
        "frontendUrl": settings.frontend_url,
    }


@router.get("/github/login")
def github_login(
    force_reauth: bool = Query(default=False),
    hard_reauth: bool = Query(default=False),
    github_logout: bool = Query(default=False),
    login: str | None = Query(default=None),
    prompt: str | None = Query(default=None),
    return_to: str | None = Query(default=None),
) -> dict:
    use_hard = hard_reauth or github_logout
    url = auth_oauth.build_github_login_url(
        force_reauth=force_reauth,
        hard_reauth=use_hard,
        login=login,
        prompt=prompt,
        return_path=return_to or "/",
    )
    return {"url": url}


@router.get("/github/callback")
async def github_callback(
    code: str | None = Query(default=None),
    error: str | None = Query(default=None),
    state: str | None = Query(default=None),
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
    return_path = auth_oauth.parse_oauth_state(state)
    next_qs = quote(return_path, safe="")
    return RedirectResponse(
        f"{settings.frontend_url}/auth/callback?token={token}&next={next_qs}",
        status_code=302,
    )


@router.post("/logout")
def logout() -> dict:
    return {"ok": True}


@router.get("/me")
def auth_me(user: AuthUser = Depends(get_current_user)) -> dict:
    return auth_users_repo.user_to_api(user)


@router.get("/github/account")
async def github_account(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return await auth_users_repo.github_account_to_api(db, user)
