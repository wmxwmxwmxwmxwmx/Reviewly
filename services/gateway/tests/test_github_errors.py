"""Tests for GitHub API error mapping."""
from __future__ import annotations

import httpx
import pytest
from fastapi import HTTPException

from app.github import github_errors


def _response(status: int, message: str) -> httpx.Response:
    return httpx.Response(
        status,
        json={"message": message},
        request=httpx.Request("GET", "https://api.github.com/test"),
    )


def test_rate_limit_without_pat() -> None:
    resp = _response(403, "API rate limit exceeded for 1.2.3.4")
    with pytest.raises(HTTPException) as exc:
        github_errors.raise_for_github_response(resp, resource="该仓库", has_pat=False)
    assert exc.value.status_code == 429
    detail = exc.value.detail
    assert isinstance(detail, dict)
    assert "GITHUB_PAT" in detail["error"]


def test_rate_limit_with_pat() -> None:
    resp = _response(403, "API rate limit exceeded for 1.2.3.4")
    with pytest.raises(HTTPException) as exc:
        github_errors.raise_for_github_response(resp, resource="该仓库", has_pat=True)
    assert exc.value.status_code == 429
    assert "稍后再试" in exc.value.detail["error"]


def test_not_found() -> None:
    resp = _response(404, "Not Found")
    with pytest.raises(HTTPException) as exc:
        github_errors.raise_for_github_response(resp, resource="该 PR", has_pat=False)
    assert exc.value.status_code == 404
    assert "未找到" in exc.value.detail["error"]


def test_forbidden_private_repo() -> None:
    resp = _response(403, "Repository access blocked")
    with pytest.raises(HTTPException) as exc:
        github_errors.raise_for_github_response(resp, resource="该仓库", has_pat=False)
    assert exc.value.status_code == 403
    assert "私有" in exc.value.detail["error"] or "GITHUB_PAT" in exc.value.detail["error"]


def test_invalid_pat() -> None:
    resp = _response(401, "Bad credentials")
    with pytest.raises(HTTPException) as exc:
        github_errors.raise_for_github_response(resp, resource="该仓库", has_pat=True)
    assert exc.value.status_code == 401
    assert "GITHUB_PAT" in exc.value.detail["error"]


def test_github_client_passes_has_pat_on_error() -> None:
    """GitHubClient must pass has_pat to avoid TypeError on failed responses."""
    import inspect

    from app.integrations.github import github_client as canonical

    source = inspect.getsource(canonical.GitHubClient)
    assert "has_pat=True" in source
    assert source.count("raise_for_github_response") >= 2
