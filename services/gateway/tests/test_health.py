from fastapi.testclient import TestClient


def test_root(client: TestClient) -> None:
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "prism-gateway"


def test_health(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["ready"] is True


def test_api_returns_503_while_gateway_not_ready(client: TestClient) -> None:
    import app.main as main_module

    main_module.app.state.ready = False
    try:
        r = client.get("/api/governance/rules")
        assert r.status_code == 503
        assert r.json()["code"] == "GATEWAY_STARTING"
    finally:
        main_module.app.state.ready = True


def test_dashboard(client: TestClient) -> None:
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert "pendingPrs" in data
    assert "summary" in data
    assert "riskDistribution" in data
    assert "analysisTiming" in data
    assert "activities" in data
