"""Dashboard analysis cache metrics."""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_dashboard_includes_analysis_cache(client: TestClient) -> None:
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert "analysisCache" in data
    cache = data["analysisCache"]
    assert "hitRate" in cache
    assert "savedTimeLabel" in cache
    assert "estimatedCostSavedUsd" in cache
