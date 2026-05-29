"""Persisted AI content on findings, repos, and dashboard."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def test_security_finding_ai_insight_persisted(client: TestClient) -> None:
    listed = client.get("/api/security/findings?pageSize=1").json()
    if not listed.get("items"):
        pytest.skip("no security findings")
    finding_id = listed["items"][0]["id"]
    content = "## 风险原理\n\n测试持久化解读。"

    patch = client.patch(
        f"/api/security/findings/{finding_id}",
        json={
            "aiInsight": {
                "content": content,
                "analyzedAt": "2026-05-29T12:00:00Z",
                "model": "deepseek-chat",
            },
        },
    )
    assert patch.status_code == 200

    page = client.get("/api/security/findings?pageSize=50").json()
    match = next((x for x in page["items"] if x["id"] == finding_id), None)
    assert match is not None
    assert match["aiInsight"]["content"] == content


def test_performance_finding_ai_optimization_persisted(client: TestClient) -> None:
    listed = client.get("/api/performance/findings?pageSize=1").json()
    if not listed.get("items"):
        pytest.skip("no performance findings")
    finding_id = listed["items"][0]["id"]
    content = "## 优化方案\n\n测试持久化优化。"

    patch = client.patch(
        f"/api/performance/findings/{finding_id}",
        json={
            "aiOptimization": {
                "content": content,
                "analyzedAt": "2026-05-29T12:00:00Z",
            },
        },
    )
    assert patch.status_code == 200

    page = client.get("/api/performance/findings?pageSize=50").json()
    match = next((x for x in page["items"] if x["id"] == finding_id), None)
    assert match is not None
    assert match["aiOptimization"]["content"] == content


def test_repo_architecture_analysis_persisted(client: TestClient) -> None:
    repos = client.get("/api/repos").json()
    if not repos:
        pytest.skip("no repos")
    repo_id = repos[0]["id"]
    content = "## 架构建议\n\n测试架构 AI 持久化。"

    save = client.put(
        f"/api/repos/{repo_id}/architecture-analysis",
        json={"content": content, "provider": "deepseek"},
    )
    assert save.status_code == 200
    assert save.json()["aiArchitectureAnalysis"]["content"] == content

    listed = client.get("/api/repos").json()
    match = next((x for x in listed if x["id"] == repo_id), None)
    assert match["aiArchitectureAnalysis"]["content"] == content


def test_dashboard_weekly_summary_in_get_dashboard(client: TestClient) -> None:
    from unittest.mock import AsyncMock, patch

    ai_settings = {
        "ai": {"provider": "openai", "model": "gpt-4o-mini", "temperature": 0.2},
    }
    with (
        patch(
            "app.services.dashboard_summary.settings_repo.get_settings",
            return_value=ai_settings,
        ),
        patch(
            "app.services.dashboard_summary.settings_repo.get_decrypted_secrets",
            return_value={"openai": "sk-test"},
        ),
        patch(
            "app.services.dashboard_summary.call_openai_compatible",
            new_callable=AsyncMock,
        ) as mock_llm,
    ):
        mock_llm.return_value = {"content": "## 周报\n\n测试内容", "usage": {}}
        post = client.post("/api/dashboard/weekly-summary")
    assert post.status_code == 200
    assert "测试内容" in post.json()["content"]

    dash = client.get("/api/dashboard").json()
    assert dash.get("weeklySummary") is not None
    assert "测试内容" in dash["weeklySummary"]["content"]
