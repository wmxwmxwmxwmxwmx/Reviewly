"""Backward-compatible re-export (prefer app.integrations.github.github_client)."""
from app.integrations.github.github_client import GitHubClient

__all__ = ["GitHubClient"]
