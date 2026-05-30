"""PATCH/DELETE pull request metadata."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_patch_pull_request_display_name_and_note(client: TestClient) -> None:
    listed = client.get("/api/pull-requests?includeExternal=true&limit=1").json()
    items = listed.get("items") or []
    if not items:
        return
    pr_id = items[0]["id"]

    patched = client.patch(
        f"/api/pull-requests/{pr_id}",
        json={"displayName": "测试显示名", "note": "评审备注", "favorite": True},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body.get("displayName") == "测试显示名"
    assert body.get("note") == "评审备注"
    assert body.get("favorite") is True

    cleared = client.patch(
        f"/api/pull-requests/{pr_id}",
        json={"displayName": "", "note": "", "favorite": False},
    )
    assert cleared.status_code == 200, cleared.text
    cleared_body = cleared.json()
    assert "displayName" not in cleared_body or not cleared_body.get("displayName")
    assert "note" not in cleared_body or not cleared_body.get("note")
    assert cleared_body.get("favorite") is False


def test_delete_pull_request_not_found(client: TestClient) -> None:
    r = client.delete("/api/pull-requests/pr-does-not-exist-xyz")
    assert r.status_code == 404


def test_patch_pull_request_requires_fields(client: TestClient) -> None:
    listed = client.get("/api/pull-requests?includeExternal=true&limit=1").json()
    items = listed.get("items") or []
    if not items:
        return
    pr_id = items[0]["id"]
    r = client.patch(f"/api/pull-requests/{pr_id}", json={})
    assert r.status_code == 400
