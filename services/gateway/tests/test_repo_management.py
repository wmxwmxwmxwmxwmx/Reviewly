"""Repository management: health score, list mapping, sync metadata, clone stub."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


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


def test_repos_sync_mock_without_github(client: TestClient) -> None:
    r = client.post("/api/repos/sync")
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") in ("mock", "ok")
    assert "syncedRepos" in body or "synced" in body


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


@patch("app.api.v1.placeholders.settings")
@patch("app.services.repo_sync.settings")
@patch("app.services.repo_sync.public_client.list_user_repos", new_callable=AsyncMock)
@patch("app.services.repo_sync.public_client.list_open_pull_requests", new_callable=AsyncMock)
def test_sync_metadata_pat_only(
    mock_open_prs: AsyncMock,
    mock_list_repos: AsyncMock,
    mock_sync_settings,
    mock_placeholder_settings,
    client: TestClient,
) -> None:
    mock_list_repos.return_value = [
        {
            "id": 999001,
            "full_name": "test-org/demo-repo",
            "name": "demo-repo",
            "owner": {"login": "test-org"},
            "default_branch": "main",
        }
    ]
    mock_open_prs.return_value = [{"number": 1}]
    for mock in (mock_sync_settings, mock_placeholder_settings):
        mock.github_app_id = ""
        mock.github_app_private_key = ""
        mock.github_pat = "ghp_test_token"

    r = client.post("/api/repos/sync")
    assert r.status_code == 200
    body = r.json()
    assert body.get("syncedRepos") == 1
    assert body.get("status") == "ok"

    listed = client.get("/api/repos").json()
    demo = next((x for x in listed if x.get("fullName") == "test-org/demo-repo"), None)
    assert demo is not None
    assert demo["openPrCount"] == 1
    assert demo["lastSyncTime"]
    assert 0 <= demo["healthScore"] <= 100
