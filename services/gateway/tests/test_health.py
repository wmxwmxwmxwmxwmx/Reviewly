from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root() -> None:
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "prism-gateway"


def test_dashboard() -> None:
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    assert "pendingPrs" in r.json()
