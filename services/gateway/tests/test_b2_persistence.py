from fastapi.testclient import TestClient


def test_pull_requests_after_seed(client: TestClient) -> None:
    r = client.get("/api/pull-requests")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1


def test_analysis_persists_in_session(client: TestClient) -> None:
    pr_id = client.get("/api/pull-requests").json()["items"][0]["id"]
    start = client.post(f"/api/pull-requests/{pr_id}/analysis")
    assert start.status_code == 200
    job_id = start.json()["jobId"]

    import time

    for _ in range(30):
        job = client.get(f"/api/analysis/jobs/{job_id}").json()
        if job["status"] in ("completed", "failed"):
            break
        time.sleep(0.3)

    latest = client.get(f"/api/pull-requests/{pr_id}/analysis/latest")
    assert latest.status_code == 200


def test_settings_patch(client: TestClient) -> None:
    r = client.patch("/api/settings", json={"ai": {"temperature": 0.3}})
    assert r.status_code == 200
    assert r.json()["ai"]["temperature"] == 0.3


def test_settings_security_patch(client: TestClient) -> None:
    r = client.patch(
        "/api/settings",
        json={"security": {"twoFactorEnabled": True, "sessionTimeoutMinutes": 60}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["security"]["twoFactorEnabled"] is True
    assert body["security"]["sessionTimeoutMinutes"] == 60


def test_security_stats(client: TestClient) -> None:
    r = client.get("/api/security/stats")
    assert r.status_code == 200
    body = r.json()
    assert "openFindings" in body
    assert body["status"] == "ok"


def test_findings_empty_without_job_for_non_demo_pr(client: TestClient) -> None:
    from unittest.mock import AsyncMock, patch

    from app.mock.seed import DEFAULT_PR_ID

    mock_pr = {
        "id": 999002,
        "number": 99,
        "title": "imported pr",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {"ref": "main", "repo": {"id": 889}},
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/octocat/other/pull/99",
    }
    mock_repo = {"id": 889, "full_name": "octocat/other", "default_branch": "main"}

    with (
        patch(
            "app.github.import_pr.get_installation_id_for_repo",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.github.public_client.get_repo",
            new_callable=AsyncMock,
            return_value=mock_repo,
        ),
        patch(
            "app.github.public_client.get_pull_request",
            new_callable=AsyncMock,
            return_value=mock_pr,
        ),
        patch(
            "app.github.public_client.get_pull_diff_patch",
            new_callable=AsyncMock,
            return_value="",
        ),
        patch(
            "app.github.public_client.list_pull_files",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.github.public_client.list_pull_commits",
            new_callable=AsyncMock,
            return_value=[],
        ),
    ):
        imported = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/octocat/other/pull/99"},
        )
    assert imported.status_code == 200
    pr_id = imported.json()["prId"]
    assert pr_id != DEFAULT_PR_ID

    findings = client.get(f"/api/pull-requests/{pr_id}/findings")
    assert findings.status_code == 200
    assert findings.json() == []

    latest = client.get(f"/api/pull-requests/{pr_id}/analysis/latest")
    assert latest.status_code == 404


def test_diff_parser_unit() -> None:
    from app.grpc_client.diff_parser import parse_unified_diff

    patch = """diff --git a/foo.go b/foo.go
--- a/foo.go
+++ b/foo.go
@@ -1,3 +1,4 @@
 package main
+// added
"""
    files = parse_unified_diff(patch)
    assert len(files) == 1
    assert files[0]["path"] == "foo.go"
    assert files[0]["additions"] >= 1
