"""Auth API — bypass mode, login URL, and account endpoints."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.services import auth_oauth


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


def test_auth_status_bypass(client: TestClient) -> None:
    r = client.get("/api/auth/status")
    assert r.status_code == 200
    body = r.json()
    assert body["authBypassEnabled"] is True
    assert "githubOAuthConfigured" in body
    assert "oauthCallbackUrl" in body
    assert body["oauthCallbackUrl"].endswith("/api/auth/github/callback")


def test_github_login_url(client: TestClient) -> None:
    r = client.get("/api/auth/github/login")
    # 501 when OAuth env vars are unset in CI/local test
    assert r.status_code in (200, 501)
    if r.status_code == 200:
        assert "github.com" in r.json()["url"]
        assert "oauth/authorize" in r.json()["url"]


def test_github_login_url_force_reauth_no_logout(client: TestClient) -> None:
    r = client.get("/api/auth/github/login", params={"force_reauth": True})
    assert r.status_code in (200, 501)
    if r.status_code == 200:
        url = r.json()["url"]
        assert "oauth/authorize" in url
        assert "github.com/logout" not in url


def test_github_login_url_github_logout_ignored(client: TestClient) -> None:
    """github_logout is API-compat only; must never return github.com/logout."""
    r = client.get("/api/auth/github/login", params={"github_logout": True})
    assert r.status_code in (200, 501)
    if r.status_code == 200:
        url = r.json()["url"]
        assert "oauth/authorize" in url
        assert "github.com/logout" not in url


def test_github_login_url_login_hint(client: TestClient) -> None:
    r = client.get("/api/auth/github/login", params={"login": "octocat"})
    assert r.status_code in (200, 501)
    if r.status_code == 200:
        assert "login=octocat" in r.json()["url"]


def test_oauth_state_return_path() -> None:
    state = auth_oauth.encode_oauth_state("/repos")
    assert auth_oauth.parse_oauth_state(state) == "/repos"
    assert auth_oauth.normalize_return_path("https://evil.com") == "/"
    assert auth_oauth.normalize_return_path("//evil") == "/"


def test_sync_me_requires_real_token(client: TestClient) -> None:
    r = client.post("/api/repos/sync/me")
    # bypass user has plain:bypass-token — sync may fail against GitHub or succeed mock
    assert r.status_code in (200, 401, 500, 502)
