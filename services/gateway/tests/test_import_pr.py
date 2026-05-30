"""Tests for GitHub PR URL import."""
from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.errors import SCHEMA_OUTDATED_MESSAGE
from app.github.url_parser import parse_github_pr_url
from app.mock.seed import DEFAULT_PR_ID


def _public_import_mocks(mock_pr: dict, mock_repo: dict):
    @contextmanager
    def _ctx():
        with (
            patch(
                "app.github.import_pr.get_installation_id_for_repo",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "app.github.public_client.get_repo_public",
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
            patch(
                "app.github.public_client.list_pull_files",
                new_callable=AsyncMock,
                return_value=[
                    {
                        "filename": "README.md",
                        "patch": "@@ -1 +1 @@\n+test",
                        "additions": 1,
                        "deletions": 0,
                        "status": "modified",
                    }
                ],
            ),
            patch(
                "app.github.public_client.list_pull_commits",
                new_callable=AsyncMock,
                return_value=[{"sha": "abc123"}],
            ),
        ):
            yield

    return _ctx()


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


def test_import_pull_request_ignores_demo_seed_cache(client: TestClient) -> None:
    """Demo PR rows must not be returned as import cache hits."""
    url = "https://github.com/acme-corp/backend/pull/2847"
    r = client.post("/api/pull-requests/import", json={"url": url})
    if r.status_code == 200:
        assert r.json().get("prId") != DEFAULT_PR_ID or r.json().get("source") != "cache"
    else:
        assert r.status_code in (404, 429, 500, 501, 502, 503)


def test_import_pull_request_cache_hit(client: TestClient) -> None:
    mock_pr = {
        "id": 999003,
        "number": 7,
        "title": "cache test",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {"ref": "main", "repo": {"id": 887}},
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/octocat/cache-repo/pull/7",
    }
    mock_repo = {"id": 887, "full_name": "octocat/cache-repo", "default_branch": "main"}
    url = "https://github.com/octocat/cache-repo/pull/7"

    with (
        patch(
            "app.github.import_pr.get_installation_id_for_repo",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.github.public_client.get_repo_public",
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
            return_value="",
        ),
        patch(
            "app.github.public_client.list_pull_files",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.github.public_client.list_pull_commits",
            new_callable=AsyncMock,
            return_value=[{"sha": "abc123"}],
        ),
    ):
        first = client.post("/api/pull-requests/import", json={"url": url})
        assert first.status_code == 200
        assert first.json()["source"] == "github_public"
        pr_id = first.json()["prId"]

        first_body = first.json()
        assert "repoId" in first_body
        assert first_body.get("repositoryCreated") is True

        second = client.post("/api/pull-requests/import", json={"url": url})
        assert second.status_code == 200
        second_body = second.json()
        assert second_body["source"] == "cache"
        assert second_body["prId"] == pr_id
        assert second_body["repoId"] == first_body["repoId"]
        assert second_body["repositoryCreated"] is False


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

    with _public_import_mocks(mock_pr, mock_repo):
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

    diff = client.get(f"/api/pull-requests/{data['prId']}/diff")
    assert diff.status_code == 200
    diff_files = diff.json()
    assert isinstance(diff_files, list)
    assert len(diff_files) >= 1
    first_file = diff_files[0]
    assert isinstance(first_file.get("chunks"), list)
    assert "path" in first_file
    assert "language" in first_file
    assert "riskLevel" in first_file


def test_import_pull_request_falls_back_when_installation_lookup_raises(
    client: TestClient,
) -> None:
    """401/403 on installation lookup must not 500; public import should still run."""
    mock_pr = {
        "id": 999002,
        "number": 1,
        "title": "feat: fallback",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {
            "ref": "main",
            "repo": {
                "id": 889,
                "full_name": "obra/superpowers",
                "default_branch": "main",
            },
        },
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/obra/superpowers/pull/1",
    }
    mock_repo = {
        "id": 889,
        "full_name": "obra/superpowers",
        "default_branch": "main",
    }
    request = httpx.Request(
        "GET",
        "https://api.github.com/repos/obra/superpowers/installation",
    )
    response = httpx.Response(401, request=request)
    http_error = httpx.HTTPStatusError(
        "Unauthorized",
        request=request,
        response=response,
    )

    with (
        patch.object(settings, "github_app_id", "123"),
        patch.object(settings, "github_app_private_key", "fake-key"),
        patch(
            "app.github.import_pr.get_installation_id_for_repo",
            new_callable=AsyncMock,
            side_effect=http_error,
        ),
        _public_import_mocks(mock_pr, mock_repo),
    ):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/obra/superpowers/pull/1"},
        )

    assert r.status_code == 200
    assert r.json()["source"] == "github_public"
    assert r.json()["prId"] == "pr-999002"


def _api_error_message(body: dict) -> str:
    if isinstance(body.get("error"), str):
        return body["error"]
    detail = body.get("detail")
    if isinstance(detail, dict) and isinstance(detail.get("error"), str):
        return detail["error"]
    return ""


def test_import_pull_request_returns_503_when_migrations_failed(client: TestClient) -> None:
    with patch("app.main.migration_status", "failed"):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/obra/superpowers/pull/1646"},
        )

    assert r.status_code == 503
    body = r.json()
    assert _api_error_message(body) == SCHEMA_OUTDATED_MESSAGE
    code = body.get("code") or (body.get("detail") or {}).get("code")
    assert code == "SCHEMA_OUTDATED"


def test_import_pull_request_null_nested_fields(client: TestClient) -> None:
    """GitHub may return user/head/base as null; import must not 500."""
    mock_pr = {
        "id": 999010,
        "number": 10,
        "title": "null fields",
        "state": "open",
        "user": None,
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": None,
        "base": None,
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/octocat/null-fields/pull/10",
    }
    mock_repo = {"id": 991, "full_name": "octocat/null-fields", "default_branch": "main"}

    with _public_import_mocks(mock_pr, mock_repo):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/octocat/null-fields/pull/10"},
        )

    assert r.status_code == 200
    assert r.json()["prId"] == "pr-999010"
    detail = client.get(f"/api/pull-requests/{r.json()['prId']}")
    assert detail.status_code == 200
    assert detail.json()["author"] == "unknown"


def test_import_pull_request_repo_403_uses_base_fallback(client: TestClient) -> None:
    from app.core.errors import api_error

    mock_pr = {
        "id": 999011,
        "number": 11,
        "title": "repo 403 fallback",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {
            "ref": "main",
            "repo": {
                "id": 992,
                "full_name": "obra/superpowers",
                "default_branch": "main",
            },
        },
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/obra/superpowers/pull/11",
    }

    async def raise403(*_args: object, **_kwargs: object) -> None:
        raise api_error("无法访问该仓库", 403)

    with (
        patch(
            "app.github.import_pr.get_installation_id_for_repo",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.github.public_client.get_repo_public",
            new_callable=AsyncMock,
            side_effect=raise403,
        ),
        patch(
            "app.github.public_client.get_pull_request",
            new_callable=AsyncMock,
            return_value=mock_pr,
        ),
        patch(
            "app.github.public_client.get_pull_diff_patch",
            new_callable=AsyncMock,
            return_value="",
        ),
        patch(
            "app.github.public_client.list_pull_files",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.github.public_client.list_pull_commits",
            new_callable=AsyncMock,
            return_value=[{"sha": "abc"}],
        ),
    ):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/obra/superpowers/pull/11"},
        )

    assert r.status_code == 200
    assert r.json()["source"] == "github_public"


def test_import_pull_request_repo_403_null_base_no_500(client: TestClient) -> None:
    from app.core.errors import api_error

    mock_pr = {
        "id": 999012,
        "number": 12,
        "title": "repo 403 null base",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": None,
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/octocat/null-base/pull/12",
    }

    async def raise403(*_args: object, **_kwargs: object) -> None:
        raise api_error("无法访问该仓库", 403)

    with (
        patch(
            "app.github.import_pr.get_installation_id_for_repo",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.github.public_client.get_repo_public",
            new_callable=AsyncMock,
            side_effect=raise403,
        ),
        patch(
            "app.github.public_client.get_pull_request",
            new_callable=AsyncMock,
            return_value=mock_pr,
        ),
        patch(
            "app.github.public_client.get_pull_diff_patch",
            new_callable=AsyncMock,
            return_value="",
        ),
        patch(
            "app.github.public_client.list_pull_files",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.github.public_client.list_pull_commits",
            new_callable=AsyncMock,
            return_value=[{"sha": "abc"}],
        ),
    ):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/octocat/null-base/pull/12"},
        )

    assert r.status_code == 200
    assert r.json()["prId"] == "pr-999012"


def test_import_pull_request_app_sync_http_error_falls_back(client: TestClient) -> None:
    """HTTPStatusError from GitHub App sync must fall back to public import."""
    mock_pr = {
        "id": 999013,
        "number": 13,
        "title": "app fallback",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {"ref": "main", "repo": {"id": 993, "full_name": "o/r", "default_branch": "main"}},
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/o/r/pull/13",
    }
    mock_repo = {"id": 993, "full_name": "o/r", "default_branch": "main"}
    request = httpx.Request("GET", "https://api.github.com/repos/o/r/pulls/13")
    response = httpx.Response(502, request=request)
    http_error = httpx.HTTPStatusError("Bad Gateway", request=request, response=response)

    with (
        patch.object(settings, "github_app_id", "123"),
        patch.object(settings, "github_app_private_key", "fake-key"),
        patch(
            "app.github.import_pr.get_installation_id_for_repo",
            new_callable=AsyncMock,
            return_value="inst-1",
        ),
        patch(
            "app.github.import_pr.sync.sync_single_pull_request",
            new_callable=AsyncMock,
            side_effect=http_error,
        ),
        _public_import_mocks(mock_pr, mock_repo),
    ):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/o/r/pull/13"},
        )

    assert r.status_code == 200
    assert r.json()["source"] == "github_public"
    assert r.json()["prId"] == "pr-999013"


def test_import_pull_request_diff_502_returns_readable_error(client: TestClient) -> None:
    mock_pr = {
        "id": 999014,
        "number": 14,
        "title": "diff 502",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {"ref": "main", "repo": {"id": 994, "full_name": "o/r2", "default_branch": "main"}},
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/o/r2/pull/14",
    }
    mock_repo = {"id": 994, "full_name": "o/r2", "default_branch": "main"}
    request = httpx.Request("GET", "https://api.github.com/repos/o/r2/pulls/14")
    response = httpx.Response(502, request=request)
    http_error = httpx.HTTPStatusError("Bad Gateway", request=request, response=response)

    with (
        patch(
            "app.github.import_pr.get_installation_id_for_repo",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.github.public_client.get_repo_public",
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
            side_effect=http_error,
        ),
    ):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/o/r2/pull/14"},
        )

    assert r.status_code == 502
    assert "GitHub" in _api_error_message(r.json())


def test_raise_for_github_response_502_maps_to_http_exception() -> None:
    from fastapi import HTTPException

    from app.github.github_errors import raise_for_github_response

    request = httpx.Request("GET", "https://api.github.com/test")
    response = httpx.Response(502, request=request, json={"message": "Server Error"})
    with pytest.raises(HTTPException) as exc_info:
        raise_for_github_response(response, resource="测试资源", has_pat=False)
    assert exc_info.value.status_code == 502
