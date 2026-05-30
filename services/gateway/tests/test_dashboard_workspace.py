"""Dashboard workspace API: PR filters, activity, analysis stats."""


def test_pull_requests_filter_assigned(client):
    r = client.get("/api/pull-requests", params={"filter": "assigned", "includeExternal": "true"})
    assert r.status_code == 200
    body = r.json()
    assert "total" in body
    assert "items" in body
    for item in body["items"]:
        assert item.get("reviewStatus") in ("OPEN", "IN_REVIEW")


def test_pull_requests_filter_high_risk(client):
    r = client.get("/api/pull-requests", params={"filter": "high-risk", "includeExternal": "true"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 0
    for item in body["items"]:
        assert item.get("riskLevel") in ("critical", "high")
        assert item.get("reviewStatus") not in ("MERGED", "CLOSED")


def test_recent_activity_endpoint(client):
    r = client.get("/api/pull-requests/recent-activity", params={"limit": 5})
    assert r.status_code == 200
    assert "activities" in r.json()


def test_analysis_jobs_stats(client):
    r = client.get("/api/analysis/jobs/stats")
    assert r.status_code == 200
    data = r.json()
    for key in (
        "pendingAssigned",
        "changesRequested",
        "highRisk",
        "approved",
        "weeklyAnalysisCount",
    ):
        assert key in data
        assert isinstance(data[key], int)
