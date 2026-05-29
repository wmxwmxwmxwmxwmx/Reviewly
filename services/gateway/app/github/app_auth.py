"""GitHub App JWT + installation token (B3)."""
from __future__ import annotations

from app.core.config import settings


def create_app_jwt() -> str:
    if not settings.github_app_id or not settings.github_app_private_key:
        raise RuntimeError("GitHub App 凭据未配置")
    raise NotImplementedError("B3: 实现 PyGithub / jwt 签发")
