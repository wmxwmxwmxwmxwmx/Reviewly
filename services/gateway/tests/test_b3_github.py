from fastapi.testclient import TestClient


def test_install_url(client: TestClient) -> None:
    r = client.get("/api/integrations/github/install-url")
    assert r.status_code == 200
    body = r.json()
    assert "url" in body
    assert "connected" in body
    assert "hostLabel" in body


def test_repos_sync_requires_pat_without_github(client: TestClient) -> None:
    r = client.post("/api/repos/sync")
    assert r.status_code == 500
    body = r.json()
    err = body.get("error") or (body.get("detail") or {}).get("error", "")
    assert "GitHub PAT not configured" in err


def test_webhook_installation(client: TestClient) -> None:
    payload = {
        "action": "created",
        "installation": {"id": 12345, "account": {"login": "acme-test"}},
    }
    r = client.post(
        "/api/webhooks/github",
        json=payload,
        headers={"X-GitHub-Event": "installation"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True
