"""Backward-compatible re-exports (prefer app.integrations.github)."""
from app.integrations.github.app_auth import create_app_jwt, get_installation_id_for_repo
from app.integrations.github.installation_tokens import get_installation_token

__all__ = ["create_app_jwt", "get_installation_id_for_repo", "get_installation_token"]
