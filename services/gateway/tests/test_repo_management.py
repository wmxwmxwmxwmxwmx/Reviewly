"""Repository management: health score, list mapping, sync metadata, import."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.github.url_parser import parse_github_repo_url


def test_parse_github_repo_url_variants() -> None:
    p = parse_github_repo_url("https://github.com/openai/openai-python")
    assert p.owner == "openai"
    assert p.repo == "openai-python"

    p2 = parse_github_repo_url("https://github.com/openai/openai-python.git/")
    assert p2.full_name == "openai/openai-python"


def test_parse_github_repo_url_rejects_pr_link() -> None:
    with pytest.raises(Exception):  # noqa: B017
        parse_github_repo_url("https://github.com/o/r/pull/1")


def test_list_repos_includes_owner_and_last_sync(client: TestClient) -> None:
    r = client.get("/api/repos")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        item = data[0]
        assert "owner" in item
        assert "name" in item
        assert "lastSyncTime" in item
        assert "healthScore" in item


def _error_message(body: dict) -> str:
    if isinstance(body.get("error"), str):
        return body["error"]
    detail = body.get("detail")
    if isinstance(detail, dict) and isinstance(detail.get("error"), str):
        return detail["error"]
    return ""


def test_repos_sync_requires_pat(client: TestClient) -> None:
    r = client.post("/api/repos/sync")
    assert r.status_code == 500
    assert "GitHub PAT not configured" in _error_message(r.json())


@patch("app.api.v1.repos.repo_sync.import_repository_from_url", new_callable=AsyncMock)
def test_import_repo_success(mock_import: AsyncMock, client: TestClient) -> None:
    mock_import.return_value = {
        "id": "repo-123",
        "fullName": "acme/demo",
        "owner": "acme",
        "name": "demo",
        "defaultBranch": "main",
        "openPrCount": 2,
        "healthScore": 80,
        "lastSyncTime": "2026-01-01T00:00:00Z",
        "aiReviewEnabled": True,
        "stars": 10,
        "forks": 1,
    }
    r = client.post(
        "/api/repos/import",
        json={"url": "https://github.com/acme/demo"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["repository"]["fullName"] == "acme/demo"
    mock_import.assert_called_once()


def test_import_repo_invalid_url(client: TestClient) -> None:
    r = client.post("/api/repos/import", json={"url": "not-a-url"})
    assert r.status_code == 400


@patch("app.services.repo_sync.fetch_repo_by_url", new_callable=AsyncMock)
def test_import_repo_not_found(mock_fetch: AsyncMock, client: TestClient) -> None:
    from app.core.errors import api_error

    mock_fetch.side_effect = api_error("Repository not found", 404)
    r = client.post(
        "/api/repos/import",
        json={"url": "https://github.com/missing/repo"},
    )
    assert r.status_code == 404


@patch("app.api.v1.repos.repo_sync.sync_github_repositories", new_callable=AsyncMock)
def test_sync_created_updated_counts(mock_sync: AsyncMock, client: TestClient) -> None:
    mock_sync.return_value = {
        "synced": 3,
        "created": 1,
        "updated": 2,
        "status": "ok",
        "syncedRepos": 3,
    }
    with patch("app.services.repo_sync.settings") as mock_settings:
        mock_settings.github_pat = "ghp_test"
        mock_settings.github_app_id = ""
        mock_settings.github_app_private_key = ""
        r = client.post("/api/repos/sync")
    assert r.status_code == 200
    body = r.json()
    assert body["synced"] == 3
    assert body["created"] == 1
    assert body["updated"] == 2


@patch("app.services.repo_sync.fetch_user_repositories", new_callable=AsyncMock)
@patch("app.services.repo_sync.settings")
def test_sync_pagination_pat(
    mock_settings,
    mock_fetch: AsyncMock,
    client: TestClient,
) -> None:
    mock_settings.github_pat = "ghp_test"
    mock_settings.github_app_id = ""
    mock_settings.github_app_private_key = ""
    mock_fetch.return_value = [
        {
            "id": 999001,
            "full_name": "test-org/demo-repo",
            "name": "demo-repo",
            "owner": {"login": "test-org"},
            "default_branch": "main",
            "stargazers_count": 5,
            "forks_count": 1,
            "private": False,
            "html_url": "https://github.com/test-org/demo-repo",
            "clone_url": "https://github.com/test-org/demo-repo.git",
            "created_at": "2020-01-01T00:00:00Z",
            "updated_at": "2020-01-02T00:00:00Z",
            "pushed_at": "2020-01-03T00:00:00Z",
        },
        {
            "id": 999002,
            "full_name": "test-org/other",
            "name": "other",
            "owner": {"login": "test-org"},
            "default_branch": "main",
            "stargazers_count": 0,
            "forks_count": 0,
            "private": False,
        },
    ]

    r = client.post("/api/repos/sync")
    assert r.status_code == 200
    body = r.json()
    assert body["synced"] == 2
    assert body["created"] >= 0

    listed = client.get("/api/repos").json()
    demo = next((x for x in listed if x.get("fullName") == "test-org/demo-repo"), None)
    assert demo is not None
    assert demo.get("stars") == 5
    assert demo.get("forks") == 1


@patch("app.services.repo_clone._run_git")
@patch("app.services.repo_clone._resolve_token", new_callable=AsyncMock)
def test_repo_clone_ok(
    mock_token: AsyncMock,
    mock_git,
    client: TestClient,
) -> None:
    mock_token.return_value = "ghp_test"
    repos = client.get("/api/repos").json()
    if not repos:
        pytest.skip("no repos in db")
    repo_id = repos[0]["id"]
    r = client.post(f"/api/repos/{repo_id}/clone")
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_analyze_context_not_found(client: TestClient) -> None:
    r = client.get("/api/repos/repo-does-not-exist/analyze-context")
    assert r.status_code == 404


def test_save_and_list_repo_ai_analysis(client: TestClient) -> None:
    repos = client.get("/api/repos").json()
    if not repos:
        pytest.skip("no repos in db")
    repo_id = repos[0]["id"]
    content = "## 项目复杂度分析\n\n测试持久化内容。"

    save = client.put(
        f"/api/repos/{repo_id}/ai-analysis",
        json={"content": content, "model": "deepseek-chat", "provider": "deepseek"},
    )
    assert save.status_code == 200
    body = save.json()
    assert body["id"] == repo_id
    assert body["aiAnalysis"]["content"] == content
    assert body["aiAnalysis"]["analyzedAt"]
    assert body["aiAnalysis"]["model"] == "deepseek-chat"

    listed = client.get("/api/repos").json()
    match = next((x for x in listed if x["id"] == repo_id), None)
    assert match is not None
    assert match["aiAnalysis"]["content"] == content


def test_save_architecture_analysis_not_found(client: TestClient) -> None:
    r = client.put(
        "/api/repos/repo-does-not-exist/architecture-analysis",
        json={"content": "test"},
    )
    assert r.status_code == 404


def test_save_ai_analysis_not_found(client: TestClient) -> None:
    r = client.put(
        "/api/repos/repo-does-not-exist/ai-analysis",
        json={"content": "test"},
    )
    assert r.status_code == 404
