from fastapi.testclient import TestClient


def test_security_crud(client: TestClient) -> None:
    created = client.post(
        "/api/security/findings",
        json={
            "title": "测试漏洞",
            "severity": "high",
            "file": "test.go",
            "line": 10,
        },
    )
    assert created.status_code == 200
    fid = created.json()["id"]

    got = client.get(f"/api/security/findings/{fid}")
    assert got.status_code == 200

    updated = client.patch(f"/api/security/findings/{fid}", json={"severity": "medium"})
    assert updated.status_code == 200
    assert updated.json()["severity"] == "medium"

    deleted = client.delete(f"/api/security/findings/{fid}")
    assert deleted.status_code == 200


def test_governance_rules_crud(client: TestClient) -> None:
    created = client.post(
        "/api/governance/rules",
        json={"rule": "禁止 console.log", "severity": "medium", "violated": False},
    )
    assert created.status_code == 200
    rid = created.json()["id"]

    client.patch(f"/api/governance/rules/{rid}", json={"violated": True})
    assert client.delete(f"/api/governance/rules/{rid}").status_code == 200


def test_team_members_list(client: TestClient) -> None:
    r = client.get("/api/team/members")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_performance_stats(client: TestClient) -> None:
    r = client.get("/api/performance/stats")
    assert r.status_code == 200
    assert "openFindings" in r.json()
