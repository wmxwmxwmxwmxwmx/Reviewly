"""Review center: status, comments, timeline, approval block."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _first_pr(client: TestClient) -> str | None:
    listed = client.get("/api/pull-requests?includeExternal=true&limit=1").json()
    items = listed.get("items") or []
    if not items:
        return None
    return items[0]["id"]


def test_review_status_counts(client: TestClient) -> None:
    r = client.get("/api/review-center/status-counts")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "ALL" in body
    assert "OPEN" in body


def test_review_dashboard_and_stats(client: TestClient) -> None:
    dash = client.get("/api/review-center/dashboard")
    assert dash.status_code == 200, dash.text
    assert "assignedToMe" in dash.json()

    stats = client.get("/api/review-center/stats")
    assert stats.status_code == 200, stats.text
    assert "aiCalls" in stats.json()


def test_review_comment_and_timeline(client: TestClient) -> None:
    pr_id = _first_pr(client)
    if not pr_id:
        return

    comment = client.post(
        f"/api/review-center/pull-requests/{pr_id}/comments",
        json={"type": "COMMENT", "content": "请补充单元测试"},
    )
    assert comment.status_code == 200, comment.text
    assert comment.json().get("type") == "COMMENT"

    timeline = client.get(f"/api/review-center/pull-requests/{pr_id}/timeline")
    assert timeline.status_code == 200, timeline.text
    events = timeline.json().get("items") or []
    assert any(e.get("eventType") == "COMMENT" for e in events)


def test_review_status_patch(client: TestClient) -> None:
    pr_id = _first_pr(client)
    if not pr_id:
        return

    patched = client.patch(
        f"/api/review-center/pull-requests/{pr_id}/review-status",
        json={"reviewStatus": "IN_REVIEW"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json().get("reviewStatus") == "IN_REVIEW"


def test_approval_check(client: TestClient) -> None:
    pr_id = _first_pr(client)
    if not pr_id:
        return

    check = client.get(f"/api/review-center/pull-requests/{pr_id}/approval-check")
    assert check.status_code == 200, check.text
    body = check.json()
    assert "blocked" in body
    assert "reasons" in body
