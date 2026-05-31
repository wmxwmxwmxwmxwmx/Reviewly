"""Tests for provider balance lookup."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import httpx

from app.services import provider_balance


def test_fetch_deepseek_balance_success() -> None:
    mock_response = httpx.Response(
        200,
        json={
            "is_available": True,
            "balance_infos": [
                {
                    "currency": "CNY",
                    "total_balance": "110.00",
                    "granted_balance": "0.00",
                    "top_up_balance": "110.00",
                }
            ],
        },
        request=httpx.Request("GET", "https://api.deepseek.com/user/balance"),
    )

    with patch("app.services.provider_balance.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.get = AsyncMock(return_value=mock_response)
        client_cls.return_value = client

        result = asyncio.run(
            provider_balance.fetch_provider_balance(
                provider="deepseek",
                api_key="sk-test",
            )
        )

    assert result["available"] is True
    assert result["amount"] == "¥110.00"


def test_fetch_openrouter_balance_success() -> None:
    mock_response = httpx.Response(
        200,
        json={"data": {"limit_remaining": 12.5}},
        request=httpx.Request("GET", "https://openrouter.ai/api/v1/auth/key"),
    )

    with patch("app.services.provider_balance.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.get = AsyncMock(return_value=mock_response)
        client_cls.return_value = client

        result = asyncio.run(
            provider_balance.fetch_provider_balance(
                provider="openrouter",
                api_key="sk-or-test",
            )
        )

    assert result["available"] is True
    assert result["amount"] == "$12.50"


def test_balance_endpoint(client, db) -> None:
    from app.repositories import settings as settings_repo

    settings_repo.patch_settings(
        db,
        {
            "ai": {"provider": "deepseek", "model": "deepseek-chat", "temperature": 0.2},
            "secrets": {"deepseek": "sk-test"},
        },
    )

    mock_response = httpx.Response(
        200,
        json={
            "balance_infos": [{"currency": "CNY", "total_balance": "88.00"}],
        },
        request=httpx.Request("GET", "https://api.deepseek.com/user/balance"),
    )

    with patch("app.services.provider_balance.httpx.AsyncClient") as client_cls:
        http_client = AsyncMock()
        http_client.__aenter__.return_value = http_client
        http_client.get = AsyncMock(return_value=mock_response)
        client_cls.return_value = http_client

        response = client.post("/api/models/balance", json={})

    assert response.status_code == 200
    payload = response.json()
    assert payload["available"] is True
    assert payload["amount"] == "¥88.00"
