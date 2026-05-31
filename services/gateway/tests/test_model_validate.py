"""Tests for model configuration validation."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import httpx

from app.services import model_validate


def test_validate_openai_compatible_success() -> None:
    mock_response = httpx.Response(
        200,
        json={
            "model": "gpt-4o-mini",
            "choices": [{"message": {"content": "p"}}],
        },
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    with patch("app.services.model_validate.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.post = AsyncMock(return_value=mock_response)
        client_cls.return_value = client

        result = asyncio.run(
            model_validate.validate_model_config(
                provider="openai",
                model="gpt-4o-mini",
                api_key="sk-test",
            )
        )

    assert result["success"] is True
    assert result["model"] == "gpt-4o-mini"
    assert result["provider"] == "OpenAI"
    assert result["status"] == "Available"
    assert isinstance(result["latency"], int)


def test_validate_invalid_api_key() -> None:
    mock_response = httpx.Response(
        401,
        json={"error": {"message": "Invalid API Key"}},
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    with patch("app.services.model_validate.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.post = AsyncMock(return_value=mock_response)
        client_cls.return_value = client

        result = asyncio.run(
            model_validate.validate_model_config(
                provider="openai",
                model="gpt-4o-mini",
                api_key="bad-key",
            )
        )

    assert result["success"] is False
    assert result["errorType"] == model_validate.ERROR_INVALID_API_KEY


def test_validate_model_not_found() -> None:
    mock_response = httpx.Response(
        404,
        json={"error": {"message": "model not found"}},
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    with patch("app.services.model_validate.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.post = AsyncMock(return_value=mock_response)
        client_cls.return_value = client

        result = asyncio.run(
            model_validate.validate_model_config(
                provider="openai",
                model="missing-model",
                api_key="sk-test",
            )
        )

    assert result["success"] is False
    assert result["errorType"] == model_validate.ERROR_MODEL_NOT_FOUND


def test_validate_connection_failed() -> None:
    with patch("app.services.model_validate.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.post = AsyncMock(side_effect=httpx.ConnectError("connection refused"))
        client_cls.return_value = client

        result = asyncio.run(
            model_validate.validate_model_config(
                provider="custom",
                model="demo",
                api_key="sk-test",
                base_url="http://127.0.0.1:59999/v1/chat/completions",
            )
        )

    assert result["success"] is False
    assert result["errorType"] == model_validate.ERROR_CONNECTION_FAILED


def test_validate_endpoint_via_api(client) -> None:
    mock_response = httpx.Response(
        200,
        json={"model": "gpt-4o-mini", "choices": [{"message": {"content": "p"}}]},
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    with patch("app.services.model_validate.httpx.AsyncClient") as client_cls:
        http_client = AsyncMock()
        http_client.__aenter__.return_value = http_client
        http_client.post = AsyncMock(return_value=mock_response)
        client_cls.return_value = http_client

        response = client.post(
            "/api/models/validate",
            json={
                "provider": "openai",
                "model": "gpt-4o-mini",
                "apiKey": "sk-test",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["model"] == "gpt-4o-mini"
