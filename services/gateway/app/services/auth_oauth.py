"""GitHub OAuth login flow."""
from __future__ import annotations

import base64
import json
import logging
import secrets
from urllib.parse import quote, urlencode

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.core.security import create_access_token
from app.repositories import auth_users as auth_users_repo

logger = logging.getLogger(__name__)

_OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize"
_GITHUB_LOGOUT = "https://github.com/logout"
_OAUTH_TOKEN = "https://github.com/login/oauth/access_token"
_GITHUB_USER = "https://api.github.com/user"
_GITHUB_EMAILS = "https://api.github.com/user/emails"

_SCOPES = "repo read:user user:email"

_PLACEHOLDER_MARKERS = (
    "<your-client-id>",
    "<your-client-secret>",
    "<your-pat>",
    "your-client-id",
    "your-client-secret",
    "changeme",
    "replace-me",
)


def _is_real_secret(value: str) -> bool:
    cleaned = (value or "").strip()
    if not cleaned:
        return False
    lower = cleaned.lower()
    return not any(marker in lower for marker in _PLACEHOLDER_MARKERS)


def _oauth_configured() -> bool:
    return _is_real_secret(settings.github_oauth_client_id) and _is_real_secret(
        settings.github_oauth_client_secret
    )


def is_oauth_configured() -> bool:
    """Public check for OAuth App credentials (excludes template placeholders)."""
    return _oauth_configured()


def normalize_return_path(return_path: str | None) -> str:
    """Allow only same-site relative paths for post-login redirect."""
    path = (return_path or "/").strip()
    if not path.startswith("/") or path.startswith("//"):
        return "/"
    if "://" in path:
        return "/"
    return path


def encode_oauth_state(return_path: str = "/") -> str:
    safe_path = normalize_return_path(return_path)
    payload = {"n": secrets.token_urlsafe(16), "r": safe_path}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def parse_oauth_state(state: str | None) -> str:
    if not state:
        return "/"
    try:
        pad = "=" * (-len(state) % 4)
        raw = base64.urlsafe_b64decode(state + pad)
        payload = json.loads(raw)
        if isinstance(payload, dict) and "r" in payload:
            return normalize_return_path(str(payload["r"]))
    except (ValueError, json.JSONDecodeError, TypeError):
        pass
    return "/"


def _resolve_prompt(*, force_reauth: bool, prompt: str | None) -> str | None:
    """GitHub OAuth App supports prompt=select_account (account picker)."""
    if prompt and prompt.strip() == "select_account":
        return "select_account"
    if force_reauth:
        return "select_account"
    return None


def build_github_login_url(
    *,
    state: str | None = None,
    force_reauth: bool = False,
    hard_reauth: bool = False,
    github_logout: bool = False,  # noqa: ARG001 — API compat; use hard_reauth
    login: str | None = None,
    prompt: str | None = None,
    return_path: str = "/",
) -> str:
    if not _oauth_configured():
        raise api_error(
            "GitHub OAuth 未配置：请在 deploy/.env 或 services/gateway/.env 中设置有效的 "
            "GITHUB_OAUTH_CLIENT_ID 与 GITHUB_OAUTH_CLIENT_SECRET（勿使用 <your-client-id> 占位符）。"
            "详见 README「GitHub OAuth 登录配置」。",
            501,
        )
    use_hard = hard_reauth or github_logout
    oauth_state = state or encode_oauth_state(return_path)
    params = {
        "client_id": settings.github_oauth_client_id,
        "redirect_uri": settings.oauth_callback_url,
        "scope": _SCOPES,
        "state": oauth_state,
    }
    login_hint = (login or "").strip()
    if login_hint:
        params["login"] = login_hint
    resolved_prompt = _resolve_prompt(
        force_reauth=force_reauth and not use_hard,
        prompt=prompt,
    )
    if resolved_prompt:
        params["prompt"] = resolved_prompt
    authorize_url = f"{_OAUTH_AUTHORIZE}?{urlencode(params)}"
    if use_hard:
        return f"{_GITHUB_LOGOUT}?return_to={quote(authorize_url, safe='')}"
    return authorize_url


async def _exchange_code(code: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            _OAUTH_TOKEN,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_oauth_client_id,
                "client_secret": settings.github_oauth_client_secret,
                "code": code,
                "redirect_uri": settings.oauth_callback_url,
            },
        )
        if resp.status_code >= 400:
            logger.error("GitHub token exchange failed: %s", resp.text)
            raise api_error("GitHub OAuth token exchange failed", 502)
        return resp.json()


async def _fetch_github_user(access_token: str) -> tuple[dict, str | None]:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        user_resp = await client.get(_GITHUB_USER, headers=headers)
        if user_resp.status_code >= 400:
            raise api_error("Failed to fetch GitHub user profile", 502)
        user = user_resp.json()
        email = user.get("email")
        if not email:
            emails_resp = await client.get(_GITHUB_EMAILS, headers=headers)
            if emails_resp.status_code < 400:
                for item in emails_resp.json():
                    if item.get("primary") and item.get("email"):
                        email = item["email"]
                        break
        return user, email


async def handle_oauth_callback(session: Session, code: str) -> dict:
    token_data = await _exchange_code(code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise api_error("GitHub did not return an access token", 502)

    gh_user, email = await _fetch_github_user(access_token)
    github_id = str(gh_user["id"])
    username = gh_user.get("login") or "unknown"
    avatar_url = gh_user.get("avatar_url")

    row = auth_users_repo.upsert_from_github(
        session,
        github_id=github_id,
        username=username,
        email=email,
        avatar_url=avatar_url,
        access_token=access_token,
        refresh_token=token_data.get("refresh_token"),
    )
    session.commit()

    jwt_token = create_access_token(user_id=row.id, username=row.username)
    logger.info("User %s logged in via GitHub OAuth", username)
    return {
        "token": jwt_token,
        "user": auth_users_repo.user_to_api(row),
    }
