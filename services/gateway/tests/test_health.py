from fastapi.testclient import TestClient


def test_root(client: TestClient) -> None:
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "prism-gateway"


def test_health(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_dashboard(client: TestClient) -> None:
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    assert "pendingPrs" in r.json()
