"""Tests for governance rule evaluation."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.services.governance_evaluator import evaluate_rule


def test_keyword_match_in_patch() -> None:
    rule = {
        "id": "g-test",
        "rule": "禁止打印 token",
        "matchType": "keyword",
        "keywords": ["token"],
    }
    result = evaluate_rule(
        rule,
        patch="fmt.Println(userToken)",
        file_paths=["internal/payment/processor.go"],
        findings=[],
    )
    assert result.violated is True
    assert result.feedback
    assert "token" in (result.feedback or "").lower()


def test_file_pattern_match() -> None:
    rule = {
        "id": "g-fp",
        "rule": "支付目录变更需审查",
        "matchType": "file_pattern",
        "filePatterns": ["**/payment/**"],
    }
    result = evaluate_rule(
        rule,
        patch="",
        file_paths=["internal/payment/processor.go"],
        findings=[],
    )
    assert result.violated is True
    assert result.file == "internal/payment/processor.go"


def test_finding_match() -> None:
    rule = {
        "id": "g-find",
        "rule": "存在高危安全问题则阻塞",
        "matchType": "finding",
        "findingTypes": ["security"],
        "findingSeverities": ["high"],
    }
    findings = [
        {
            "id": "f1",
            "type": "security",
            "severity": "high",
            "title": "SQL injection",
            "file": "db.go",
            "line": 10,
        }
    ]
    result = evaluate_rule(rule, patch="", file_paths=[], findings=findings)
    assert result.violated is True
    assert "SQL" in (result.feedback or "")


def test_governance_after_analysis(client: TestClient) -> None:
    from app.mock.seed import DEFAULT_PR_ID

    created = client.post(
        "/api/governance/rules",
        json={
            "rule": "禁止 TODO 注释",
            "severity": "low",
            "matchType": "keyword",
            "keywords": ["TODO"],
            "enabled": True,
        },
    )
    assert created.status_code == 200
    rule_id = created.json()["id"]

    job = client.post(f"/api/pull-requests/{DEFAULT_PR_ID}/analysis")
    assert job.status_code == 200
    job_id = job.json()["jobId"]

    import time

    for _ in range(40):
        status = client.get(f"/api/analysis/jobs/{job_id}").json()
        if status["status"] in ("completed", "failed"):
            break
        time.sleep(0.15)
    assert status["status"] == "completed"

    gov = client.get(f"/api/pull-requests/{DEFAULT_PR_ID}/governance").json()
    row = next((r for r in gov if r["id"] == rule_id), None)
    assert row is not None
    assert "feedback" in row

    client.delete(f"/api/governance/rules/{rule_id}")
