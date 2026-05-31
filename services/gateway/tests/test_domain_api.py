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


def test_pr_governance_checks(client: TestClient) -> None:
    prs = client.get("/api/pull-requests").json()["items"]
    assert prs, "expected at least one non-seed pull request"
    pr_id = prs[0]["id"]

    created = client.post(
        "/api/governance/rules",
        json={"rule": "禁止硬编码密钥", "severity": "high", "enabled": True},
    )
    assert created.status_code == 200

    r = client.get(f"/api/pull-requests/{pr_id}/governance")
    assert r.status_code == 200
    rules = r.json()
    assert isinstance(rules, list)
    assert len(rules) >= 1
    assert any(item.get("id") == created.json()["id"] for item in rules)


def test_governance_rules_crud(client: TestClient) -> None:
    created = client.post(
        "/api/governance/rules",
        json={"rule": "禁止 console.log", "severity": "medium", "violated": False},
    )
    assert created.status_code == 200
    rid = created.json()["id"]

    client.patch(f"/api/governance/rules/{rid}", json={"severity": "high"})
    assert client.delete(f"/api/governance/rules/{rid}").status_code == 200


def test_governance_rules_create_ui_payload(client: TestClient) -> None:
    """Matches GovernanceRuleDialog → createGovernanceRule request body."""
    created = client.post(
        "/api/governance/rules",
        json={
            "rule": "嘿嘿嘿",
            "severity": "medium",
            "enabled": True,
            "matchType": "keyword",
            "keywords": ["token", "password", "密钥"],
            "filePatterns": [],
            "findingTypes": [],
            "findingSeverities": [],
        },
    )
    assert created.status_code == 200
    body = created.json()
    assert body["rule"] == "嘿嘿嘿"
    assert body["matchType"] == "keyword"
    assert "密钥" in body["keywords"]

    listed = client.get("/api/governance/rules", params={"includeDisabled": True})
    assert listed.status_code == 200
    assert any(r["id"] == body["id"] for r in listed.json())

    assert client.delete(f"/api/governance/rules/{body['id']}").status_code == 200


def test_team_members_list(client: TestClient) -> None:
    r = client.get("/api/team/members")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_performance_stats(client: TestClient) -> None:
    r = client.get("/api/performance/stats")
    assert r.status_code == 200
    assert "openFindings" in r.json()
