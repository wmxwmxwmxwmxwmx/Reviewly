"""Architecture scan and graph building."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.architecture.graph_builder import build_graph

FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "sample_repo"


def test_build_graph_from_fixture() -> None:
    graph = build_graph(FIXTURE_ROOT)
    assert len(graph["nodes"]) >= 4
    assert len(graph["edges"]) >= 1
    summary = graph["metrics"]["summary"]
    assert summary["fileCount"] == len(graph["nodes"])
    assert "filesDiscovered" in summary
    assert summary.get("truncated") is False
    langs = graph["metrics"]["summary"]["languages"]
    assert langs.get("python", 0) >= 3


def test_scan_endpoint_uses_fixture(client: TestClient) -> None:
    repos = client.get("/api/repos").json()
    if not repos:
        pytest.skip("no repos")
    repo_id = repos[0]["id"]

    with patch(
        "app.services.architecture_scan.ensure_repo_clone",
        new_callable=AsyncMock,
    ) as mock_clone:
        mock_clone.return_value = {
            "ok": True,
            "path": str(FIXTURE_ROOT.resolve()),
            "ref": "main",
            "cached": True,
        }
        r = client.post("/api/architecture/scan", json={"repoId": repo_id})

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert len(body["nodes"]) >= 4
    assert "metrics" in body

    g = client.get(f"/api/architecture/repos/{repo_id}/graph")
    assert g.status_code == 200
    assert len(g.json()["nodes"]) >= 4


def test_scan_stream_reports_progress(client: TestClient) -> None:
    repos = client.get("/api/repos").json()
    if not repos:
        pytest.skip("no repos")
    repo_id = repos[0]["id"]

    with patch(
        "app.services.architecture_scan.ensure_repo_clone",
        new_callable=AsyncMock,
    ) as mock_clone:
        mock_clone.return_value = {
            "ok": True,
            "path": str(FIXTURE_ROOT.resolve()),
            "ref": "main",
            "cached": True,
        }
        r = client.post("/api/architecture/scan", json={"repoId": repo_id, "stream": True})

    assert r.status_code == 200
    assert "progress" in r.text
    assert "complete" in r.text
    assert "[DONE]" in r.text or "done" in r.text.lower()


def test_architecture_analyze_rejects_empty_graph(client: TestClient) -> None:
    repos = client.get("/api/repos").json()
    if not repos:
        pytest.skip("no repos")
    repo_id = repos[0]["id"]
    empty = {"nodes": [], "edges": [], "metrics": {}, "status": "empty"}
    with patch(
        "app.services.architecture_analyze.architecture_repo.get_dependency_graph",
        return_value=empty,
    ):
        r = client.post(f"/api/architecture/repos/{repo_id}/analyze")
    assert r.status_code == 200
    assert "请先" in r.text


def test_architecture_analyze_requires_api_key(client: TestClient) -> None:
    repos = client.get("/api/repos").json()
    if not repos:
        pytest.skip("no repos")
    repo_id = repos[0]["id"]
    r = client.post(f"/api/architecture/repos/{repo_id}/analyze")
    assert r.status_code == 200
    body = r.text
    assert "error" in body or "API Key" in body
