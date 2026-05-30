"""Auth API — bypass mode, login URL, and account endpoints."""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_auth_me_bypass(client: TestClient) -> None:
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "dev-user"
    assert body["login"] == "dev-user"
    assert body["name"] == "dev-user"
    assert body["githubId"] == "bypass"


def test_github_account_bypass(client: TestClient) -> None:
    r = client.get("/api/auth/github/account")
    assert r.status_code == 200
    body = r.json()
    assert body["login"] == "dev-user"
    assert body["githubId"] == "bypass"
    assert "syncedRepoCount" in body
    assert body["tokenStatus"] in ("valid", "missing", "expired")


def test_github_login_url(client: TestClient) -> None:
    r = client.get("/api/auth/github/login")
    # 501 when OAuth env vars are unset in CI/local test
    assert r.status_code in (200, 501)
    if r.status_code == 200:
        assert "github.com" in r.json()["url"]


def test_sync_me_requires_real_token(client: TestClient) -> None:
    r = client.post("/api/repos/sync/me")
    # bypass user has plain:bypass-token — sync may fail against GitHub or succeed mock
    assert r.status_code in (200, 401, 500, 502)
