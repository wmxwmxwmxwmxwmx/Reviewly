"""Tests for PR AI summary persistence and chat API key resolution."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


def test_pr_ai_summary_patch_and_get(client: TestClient) -> None:
    pr_id = client.get("/api/pull-requests").json()["items"][0]["id"]

    missing = client.get(f"/api/pull-requests/{pr_id}/ai-summary")
    assert missing.status_code == 404

    saved = client.patch(
        f"/api/pull-requests/{pr_id}/ai-summary",
        json={
            "content": "## 摘要\n\n测试内容",
            "model": "claude-sonnet",
            "provider": "anthropic",
        },
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["content"].startswith("## 摘要")
    assert body["model"] == "claude-sonnet"

    loaded = client.get(f"/api/pull-requests/{pr_id}/ai-summary")
    assert loaded.status_code == 200
    assert loaded.json()["content"] == body["content"]


def test_chat_uses_server_api_key_when_body_empty(client: TestClient) -> None:
    with patch(
        "app.api.v1.ai._resolve_chat_config",
        return_value=("anthropic", "claude-sonnet", "sk-server-key", None),
    ), patch(
        "app.api.v1.ai.call_anthropic",
        new_callable=AsyncMock,
        return_value={
            "content": "ok",
            "usage": {"promptTokens": 1, "completionTokens": 2, "totalTokens": 3},
        },
    ) as mock_call:
        r = client.post(
            "/api/ai/chat",
            json={
                "messages": [{"role": "user", "content": "hi"}],
            },
        )

    assert r.status_code == 200
    assert r.json()["content"] == "ok"
    mock_call.assert_awaited_once()
    assert mock_call.await_args.kwargs["api_key"] == "sk-server-key"
