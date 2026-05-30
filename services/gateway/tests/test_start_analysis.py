"""Tests for POST /api/pull-requests/{id}/analysis error handling."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.errors import SCHEMA_OUTDATED_MESSAGE
from app.db.models import PullRequest, Repository
from app.services.analysis_cache import build_analysis_version


def _seed_pr_without_sha(session: Session, *, pr_id: str = "pr-no-sha") -> str:
    repo = Repository(
        id="repo-no-sha",
        team_id="team-default",
        full_name="acme/no-sha",
        github_id="9002",
        source_type="github",
    )
    pr = PullRequest(
        id=pr_id,
        repository_id=repo.id,
        number=42,
        github_id="4242",
        state="open",
        risk_score=5,
        head_sha=None,
        base_sha=None,
        analysis_version=None,
        payload={"repo": "acme/no-sha"},
    )
    session.add(repo)
    session.flush()
    session.add(pr)
    session.commit()
    return pr_id


def _api_error_message(body: dict) -> str:
    if isinstance(body.get("error"), str):
        return body["error"]
    detail = body.get("detail")
    if isinstance(detail, dict) and isinstance(detail.get("error"), str):
        return detail["error"]
    return ""


def test_start_analysis_missing_head_sha_returns_400(client: TestClient, db: Session) -> None:
    pr_id = _seed_pr_without_sha(db)
    with patch(
        "app.api.v1.data.refresh_pr_shas_from_github",
        new_callable=AsyncMock,
        return_value=False,
    ):
        r = client.post(f"/api/pull-requests/{pr_id}/analysis")
    assert r.status_code == 400
    assert "提交版本" in _api_error_message(r.json())


def test_start_analysis_after_sha_refresh_queues(client: TestClient, db: Session) -> None:
    pr_id = _seed_pr_without_sha(db, pr_id="pr-refresh-ok")

    async def _refresh(session: Session, pid: str, *, user=None) -> bool:
        row = session.get(PullRequest, pid)
        assert row is not None
        head = "abc123def4567890abcdef1234567890abcdef12"
        row.head_sha = head
        row.base_sha = "base000"
        row.analysis_version = build_analysis_version("acme/no-sha", row.number, head)
        if row.payload:
            row.payload = {**row.payload, "headSha": head}
        session.commit()
        return True

    with patch(
        "app.api.v1.data.refresh_pr_shas_from_github",
        side_effect=_refresh,
    ):
        r = client.post(f"/api/pull-requests/{pr_id}/analysis")
    assert r.status_code == 200
    body = r.json()
    assert body.get("jobId")
    assert body.get("queued") is True


def test_start_analysis_schema_outdated_on_db_error(client: TestClient, db: Session) -> None:
    from tests.test_analysis_cache import _seed_pr

    _, pr, _ = _seed_pr(db, pr_id="pr-schema-err")
    with patch(
        "app.api.v1.data.analysis_jobs.create_job",
        side_effect=OperationalError("stmt", {}, Exception("no such column")),
    ):
        r = client.post(f"/api/pull-requests/{pr.id}/analysis")
    assert r.status_code == 503
    body = r.json()
    assert _api_error_message(body) == SCHEMA_OUTDATED_MESSAGE
    code = body.get("code") or (body.get("detail") or {}).get("code")
    assert code == "SCHEMA_OUTDATED"
