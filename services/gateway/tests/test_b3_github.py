from fastapi.testclient import TestClient


def test_install_url(client: TestClient) -> None:
    r = client.get("/api/integrations/github/install-url")
    assert r.status_code == 200
    assert "url" in r.json()


def test_repos_sync_mock_without_github(client: TestClient) -> None:
    r = client.post("/api/repos/sync")
    assert r.status_code == 200
    assert "synced" in r.json() or "syncedRepos" in r.json()


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
