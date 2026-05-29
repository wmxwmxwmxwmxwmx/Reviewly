"""Dashboard API and activity events."""
from __future__ import annotations

import time

from fastapi.testclient import TestClient


def test_dashboard_weekly_summary_requires_api_key(client: TestClient) -> None:
    r = client.post("/api/dashboard/weekly-summary")
    assert r.status_code == 400


def test_activity_after_analysis(client: TestClient) -> None:
    pr_id = client.get("/api/pull-requests").json()["items"][0]["id"]
    start = client.post(f"/api/pull-requests/{pr_id}/analysis")
    assert start.status_code == 200
    job_id = start.json()["jobId"]

    for _ in range(30):
        job = client.get(f"/api/analysis/jobs/{job_id}").json()
        if job["status"] in ("completed", "failed"):
            break
        time.sleep(0.3)

    dash = client.get("/api/dashboard").json()
    assert "summary" in dash
    assert dash["analysisTiming"]["completedCount"] >= 1
    types = {a.get("type") for a in dash.get("activities", [])}
    assert "analysis_completed" in types
