from fastapi.testclient import TestClient


def test_performance_findings_list_shape(client: TestClient) -> None:
    r = client.get("/api/performance/findings?page=1&pageSize=10")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert body["total"] >= 1
    item = body["items"][0]
    for key in ("id", "file", "line", "type", "severity", "description", "suggestion"):
        assert key in item


def test_performance_findings_type_filter(client: TestClient) -> None:
    r = client.get("/api/performance/findings?type=Blocking%20IO&pageSize=100")
    assert r.status_code == 200
    for item in r.json()["items"]:
        assert "blocking" in item["type"].lower()


def test_performance_findings_search(client: TestClient) -> None:
    r = client.get("/api/performance/findings?q=sleep&pageSize=100")
    assert r.status_code == 200
    assert r.json()["total"] >= 1


def test_performance_findings_pagination(client: TestClient) -> None:
    r1 = client.get("/api/performance/findings?page=1&pageSize=1")
    r2 = client.get("/api/performance/findings?page=2&pageSize=1")
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["total"] >= 2
    if r1.json()["items"] and r2.json()["items"]:
        assert r1.json()["items"][0]["id"] != r2.json()["items"][0]["id"]
