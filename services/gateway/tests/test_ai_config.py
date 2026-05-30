"""Tests for shared AI config resolution."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services import ai_config


def test_resolve_ai_config_missing_provider(db) -> None:
    from app.repositories import settings as settings_repo

    settings_repo.patch_settings(db, {"ai": {"provider": "none", "model": "gpt-4"}})
    with pytest.raises(HTTPException) as exc:
        ai_config.resolve_ai_config(db)
    assert exc.value.status_code == 400


def test_resolve_ai_config_missing_model(db) -> None:
    from app.repositories import settings as settings_repo

    settings_repo.patch_settings(db, {"ai": {"provider": "openai", "model": ""}})
    with pytest.raises(HTTPException) as exc:
        ai_config.resolve_ai_config(db)
    assert exc.value.status_code == 400


def test_resolve_ai_config_missing_api_key(db) -> None:
    from app.repositories import settings as settings_repo

    settings_repo.patch_settings(db, {"ai": {"provider": "openai", "model": "gpt-4o-mini"}})
    with pytest.raises(HTTPException) as exc:
        ai_config.resolve_ai_config(db)
    assert exc.value.status_code == 400
    assert "API Key" in exc.value.detail["error"]
