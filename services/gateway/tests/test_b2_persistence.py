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


def test_security_stats(client: TestClient) -> None:
    r = client.get("/api/security/stats")
    assert r.status_code == 200
    body = r.json()
    assert "openFindings" in body
    assert body["status"] == "ok"


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
