from fastapi.testclient import TestClient


def test_security_findings_list_shape(client: TestClient) -> None:
    r = client.get("/api/security/findings?page=1&pageSize=10")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "total" in body
    assert body["total"] >= 1
    item = body["items"][0]
    for key in ("id", "repo", "prNumber", "file", "line", "severity", "rule", "description", "suggestion"):
        assert key in item


def test_security_findings_severity_filter(client: TestClient) -> None:
    all_r = client.get("/api/security/findings?pageSize=100")
    high_r = client.get("/api/security/findings?severity=high&pageSize=100")
    assert all_r.status_code == 200
    assert high_r.status_code == 200
    for item in high_r.json()["items"]:
        assert item["severity"] == "high"


def test_security_findings_search(client: TestClient) -> None:
    r = client.get("/api/security/findings?q=SQL&pageSize=100")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert any("sql" in (i.get("rule") or "").lower() or "sql" in (i.get("description") or "").lower() for i in items)


def test_security_findings_pagination(client: TestClient) -> None:
    r1 = client.get("/api/security/findings?page=1&pageSize=1")
    r2 = client.get("/api/security/findings?page=2&pageSize=1")
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["total"] >= 2
    if r1.json()["items"] and r2.json()["items"]:
        assert r1.json()["items"][0]["id"] != r2.json()["items"][0]["id"]
