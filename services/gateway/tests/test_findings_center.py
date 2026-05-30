from fastapi.testclient import TestClient


def test_findings_list_shape(client: TestClient) -> None:
    r = client.get("/api/findings?page=1&pageSize=10")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "total" in body
    assert "stats" in body
    assert "trends" in body
    stats = body["stats"]
    for key in ("total", "critical", "high", "medium", "low"):
        assert key in stats
    trends = body["trends"]
    assert "last7Days" in trends
    assert "last30Days" in trends
    if body["total"] >= 1:
        item = body["items"][0]
        for key in (
            "id",
            "findingType",
            "typeLabel",
            "repo",
            "prNumber",
            "file",
            "line",
            "severity",
            "rule",
            "description",
        ):
            assert key in item


def test_findings_type_security(client: TestClient) -> None:
    r = client.get("/api/findings?type=security&pageSize=50")
    assert r.status_code == 200
    for item in r.json()["items"]:
        assert item["findingType"] == "security"


def test_findings_type_performance(client: TestClient) -> None:
    r = client.get("/api/findings?type=performance&pageSize=50")
    assert r.status_code == 200
    for item in r.json()["items"]:
        assert item["findingType"] == "performance"


def test_findings_severity_filter(client: TestClient) -> None:
    r = client.get("/api/findings?severity=high&pageSize=100")
    assert r.status_code == 200
    for item in r.json()["items"]:
        assert item["severity"] == "high"


def test_findings_pagination(client: TestClient) -> None:
    r1 = client.get("/api/findings?page=1&pageSize=1")
    r2 = client.get("/api/findings?page=2&pageSize=1")
    assert r1.status_code == 200 and r2.status_code == 200
    total = r1.json()["total"]
    if total >= 2 and r1.json()["items"] and r2.json()["items"]:
        assert r1.json()["items"][0]["id"] != r2.json()["items"][0]["id"]


def test_findings_invalid_type(client: TestClient) -> None:
    r = client.get("/api/findings?type=invalid")
    assert r.status_code == 400
