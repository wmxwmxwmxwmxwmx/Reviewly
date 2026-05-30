"""Webhook tests for pull_request and installation_repositories."""
from __future__ import annotations

import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings


def _sign(body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def test_pull_request_opened_triggers_sync(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    secret = "test-webhook-secret"
    monkeypatch.setattr(settings, "github_webhook_secret", secret)
    payload = {
        "action": "opened",
        "installation": {"id": 12345},
        "repository": {"name": "repo", "owner": {"login": "acme"}},
        "pull_request": {"number": 99, "id": 555},
    }
    body = json.dumps(payload).encode()

    with (
        patch(
            "app.github.webhooks.sync_from_webhook_pr",
            new_callable=AsyncMock,
            return_value="pr-555",
        ) as sync_mock,
        patch(
            "app.services.analysis_orchestrator.enqueue_analysis",
            return_value={"jobId": "job-test", "queued": True, "cacheHit": False},
        ),
    ):
        r = client.post(
            "/api/webhooks/github",
            content=body,
            headers={
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": _sign(body, secret),
                "Content-Type": "application/json",
            },
        )

    assert r.status_code == 200
    sync_mock.assert_awaited_once()


def test_installation_repositories_added(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    secret = "test-webhook-secret-2"
    monkeypatch.setattr(settings, "github_webhook_secret", secret)
    monkeypatch.setattr(settings, "github_app_id", "1")
    monkeypatch.setattr(settings, "github_app_private_key", "fake")
    payload = {
        "action": "added",
        "installation": {"id": 99},
        "repositories_added": [{"full_name": "acme/repo"}],
    }
    body = json.dumps(payload).encode()

    with patch(
        "app.github.sync.sync_installation",
        new_callable=AsyncMock,
        return_value={"syncedRepos": 1, "syncedPrs": 0},
    ) as sync_mock:
        r = client.post(
            "/api/webhooks/github",
            content=body,
            headers={
                "X-GitHub-Event": "installation_repositories",
                "X-Hub-Signature-256": _sign(body, secret),
                "Content-Type": "application/json",
            },
        )

    assert r.status_code == 200
    sync_mock.assert_awaited_once()
    assert sync_mock.await_args is not None
    assert sync_mock.await_args.args[1] == "99"
