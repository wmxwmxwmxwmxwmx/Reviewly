"""Tests for GitHub PR URL import."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.github.url_parser import parse_github_pr_url
from app.mock.seed import DEFAULT_PR_ID


def test_parse_github_pr_url_valid() -> None:
    parsed = parse_github_pr_url("https://github.com/acme-corp/backend/pull/2847")
    assert parsed.owner == "acme-corp"
    assert parsed.repo == "backend"
    assert parsed.number == 2847


def test_parse_github_pr_url_with_files_suffix() -> None:
    parsed = parse_github_pr_url("https://github.com/o/r/pull/1/files")
    assert parsed.number == 1


def test_parse_github_pr_url_invalid() -> None:
    with pytest.raises(Exception) as exc:
        parse_github_pr_url("https://gitlab.com/o/r/-/merge_requests/1")
    assert exc.value.status_code == 400


def test_parse_github_pr_url_missing_number() -> None:
    with pytest.raises(Exception) as exc:
        parse_github_pr_url("https://github.com/obra/superpowers/pull/")
    assert exc.value.status_code == 400


def test_import_pull_request_cache_hit(client: TestClient) -> None:
    url = "https://github.com/acme-corp/backend/pull/2847"
    r = client.post("/api/pull-requests/import", json={"url": url})
    assert r.status_code == 200
    data = r.json()
    assert data["source"] == "cache"
    assert data["prId"] == DEFAULT_PR_ID


def test_import_pull_request_public_api(client: TestClient) -> None:
    mock_pr = {
        "id": 999001,
        "number": 42,
        "title": "feat: test",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {"ref": "main", "repo": {"id": 888}},
        "additions": 10,
        "deletions": 2,
        "changed_files": 1,
        "html_url": "https://github.com/octocat/Hello-World/pull/42",
    }
    mock_repo = {
        "id": 888,
        "full_name": "octocat/Hello-World",
        "default_branch": "main",
    }

    with (
        patch(
            "app.github.import_pr.get_installation_id_for_repo",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.github.public_client.get_repo",
            new_callable=AsyncMock,
            return_value=mock_repo,
        ),
        patch(
            "app.github.public_client.get_pull_request",
            new_callable=AsyncMock,
            return_value=mock_pr,
        ),
        patch(
            "app.github.public_client.get_pull_diff_patch",
            new_callable=AsyncMock,
            return_value="diff --git a/README.md b/README.md\n",
        ),
    ):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/octocat/Hello-World/pull/42"},
        )

    assert r.status_code == 200
    data = r.json()
    assert data["source"] == "github_public"
    assert data["prId"] == "pr-999001"

    detail = client.get(f"/api/pull-requests/{data['prId']}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["number"] == 42
    assert body["deploymentRisk"] in ("high", "medium", "low")
    assert body["rollbackComplexity"] in ("high", "medium", "low")
    assert isinstance(body["securityScore"], int)
