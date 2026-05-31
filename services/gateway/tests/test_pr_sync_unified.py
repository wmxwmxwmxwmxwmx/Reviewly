"""Unified PR sync: reconcile + derived open counts."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from sqlalchemy.orm import Session

from app.db.models import PullRequest, Repository
from app.repositories.repos import open_pr_counts_for_repositories
from app.services.pr_sync import (
    reconcile_closed_pull_requests,
    reconcile_soft_pull_requests,
    sync_repository_pull_requests_unified,
)


def _seed_repo(db: Session, repo_id: str = "repo-sync-test") -> Repository:
    row = Repository(
        id=repo_id,
        full_name="acme/sync-test",
        owner="acme",
        name="sync-test",
        github_id="999001",
        managed=True,
        repository_type="managed",
        owner_user_id=None,
    )
    db.add(row)
    db.flush()
    return row


def _seed_pr(
    db: Session,
    *,
    pr_id: str,
    repo_id: str,
    number: int,
    state: str = "open",
) -> PullRequest:
    row = PullRequest(
        id=pr_id,
        repository_id=repo_id,
        number=number,
        github_id=f"gh-{number}",
        state=state,
        risk_score=10,
        updated_at=datetime.now(timezone.utc),
        review_status="OPEN" if state == "open" else "CLOSED",
        payload={"title": f"PR {number}", "state": state},
    )
    db.add(row)
    db.flush()
    return row


def test_reconcile_closes_stale_open_prs(db: Session) -> None:
    repo = _seed_repo(db)
    _seed_pr(db, pr_id="pr-open-1", repo_id=repo.id, number=1, state="open")
    _seed_pr(db, pr_id="pr-stale-2", repo_id=repo.id, number=2, state="open")
    db.commit()

    closed = reconcile_closed_pull_requests(db, repo.id, {1})
    db.commit()

    assert closed == 1
    stale = db.get(PullRequest, "pr-stale-2")
    assert stale is not None
    assert stale.state == "closed"
    assert stale.review_status == "CLOSED"


def test_soft_reconcile_marks_stale_not_closed(db: Session) -> None:
    repo = _seed_repo(db)
    _seed_pr(db, pr_id="pr-stale-soft", repo_id=repo.id, number=9, state="open")
    db.commit()

    marked = reconcile_soft_pull_requests(db, repo.id, set())
    db.commit()

    assert marked == 1
    row = db.get(PullRequest, "pr-stale-soft")
    assert row is not None
    assert row.state == "open"
    assert row.payload is not None
    assert row.payload.get("syncStaleAt")


def test_unified_sync_empty_github_does_not_reconcile(db: Session) -> None:
    repo = _seed_repo(db)
    _seed_pr(db, pr_id="pr-only", repo_id=repo.id, number=5, state="open")
    db.commit()

    with patch(
        "app.services.pr_sync.fetch_repo_pull_requests",
        new_callable=AsyncMock,
        return_value=[],
    ):
        result = asyncio.run(
            sync_repository_pull_requests_unified(
                db,
                repo,
                token="fake-token",
                enqueue_analysis=False,
            )
        )

    assert result["ok"] is True
    assert result["synced"] == 0
    assert result["closed"] == 0
    assert result.get("reconcileMode") == "none"
    row = db.get(PullRequest, "pr-only")
    assert row is not None
    assert row.state == "open"
    db.refresh(repo)
    assert repo.last_synced_at is not None


def test_fetch_failure_does_not_update_last_synced_at(db: Session) -> None:
    repo = _seed_repo(db)
    db.commit()
    before = repo.last_synced_at

    with patch(
        "app.services.pr_sync.fetch_repo_pull_requests",
        new_callable=AsyncMock,
        side_effect=RuntimeError("github down"),
    ):
        result = asyncio.run(
            sync_repository_pull_requests_unified(
                db,
                repo,
                token="fake-token",
                enqueue_analysis=False,
            )
        )

    assert result["ok"] is False
    db.refresh(repo)
    assert repo.last_synced_at == before


def test_hard_reconcile_after_2min_window(db: Session) -> None:
    repo = _seed_repo(db)
    repo.last_synced_at = datetime.now(timezone.utc) - timedelta(minutes=3)
    _seed_pr(db, pr_id="pr-stale-hard", repo_id=repo.id, number=7, state="open")
    db.commit()

    gh_pr = {
        "id": 7001,
        "number": 1,
        "state": "open",
        "head": {"sha": "abc"},
        "base": {"sha": "def"},
        "title": "Open PR",
        "user": {"login": "dev"},
    }

    with patch(
        "app.services.pr_sync.fetch_repo_pull_requests",
        new_callable=AsyncMock,
        return_value=[gh_pr],
    ), patch(
        "app.services.pr_sync._persist_pr_with_token",
        new_callable=AsyncMock,
        return_value=("pr-new", True),
    ):
        result = asyncio.run(
            sync_repository_pull_requests_unified(
                db,
                repo,
                token="fake-token",
                enqueue_analysis=False,
            )
        )

    assert result["ok"] is True
    assert result["closed"] == 1
    stale = db.get(PullRequest, "pr-stale-hard")
    assert stale is not None
    assert stale.state == "closed"


def test_open_pr_count_derived(db: Session) -> None:
    repo = _seed_repo(db, "repo-count")
    _seed_pr(db, pr_id="pr-a", repo_id=repo.id, number=1, state="open")
    _seed_pr(db, pr_id="pr-b", repo_id=repo.id, number=2, state="open")
    _seed_pr(db, pr_id="pr-c", repo_id=repo.id, number=3, state="closed")
    db.commit()

    counts = open_pr_counts_for_repositories(db, [repo.id])
    assert counts.get(repo.id) == 2
