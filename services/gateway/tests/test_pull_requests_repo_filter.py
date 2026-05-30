"""Pull request list filtering by repository full name and repoId."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import PullRequest, Repository
from app.repositories import pull_requests as pr_repo


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_repo(
    session: Session,
    *,
    repo_id: str,
    full_name: str,
    name: str,
) -> Repository:
    row = Repository(
        id=repo_id,
        full_name=full_name,
        owner=full_name.split("/", 1)[0],
        name=name,
        github_id=f"gid-{repo_id}",
        source_type="github",
        source="test",
        managed=True,
        repository_type="owned",
        last_synced_at=_now(),
    )
    session.add(row)
    session.flush()
    return row


def _make_pr(
    session: Session,
    *,
    pr_id: str,
    repository_id: str,
    repo_label: str,
) -> PullRequest:
    row = PullRequest(
        id=pr_id,
        repository_id=repository_id,
        number=42,
        github_id=f"gh-pr-{pr_id}",
        state="open",
        risk_score=10,
        payload={
            "id": pr_id,
            "repo": repo_label,
            "repoId": repository_id,
            "number": 42,
            "title": "Test PR",
            "author": "dev",
            "state": "open",
            "riskLevel": "low",
            "riskScore": 10,
            "updatedAt": "2025-01-01T00:00:00Z",
        },
    )
    session.add(row)
    session.flush()
    return row


def test_list_pull_requests_by_full_name_with_legacy_short_payload(db: Session) -> None:
    repo = _make_repo(
        db,
        repo_id="repo-filter",
        full_name="acme/filter-repo",
        name="filter-repo",
    )
    _make_pr(
        db,
        pr_id="pr-filter",
        repository_id=repo.id,
        repo_label="filter-repo",
    )
    db.commit()

    items = pr_repo.list_pull_requests(db, repo="acme/filter-repo")
    assert len(items) == 1
    assert items[0]["id"] == "pr-filter"
    assert items[0]["repo"] == "acme/filter-repo"


def test_list_pull_requests_by_repo_id(db: Session) -> None:
    repo = _make_repo(
        db,
        repo_id="repo-by-id",
        full_name="acme/by-id",
        name="by-id",
    )
    _make_pr(
        db,
        pr_id="pr-by-id",
        repository_id=repo.id,
        repo_label="by-id",
    )
    db.commit()

    items = pr_repo.list_pull_requests(db, repo_id="repo-by-id")
    assert len(items) == 1
    assert items[0]["id"] == "pr-by-id"


def test_list_pull_requests_repo_filter_no_match(db: Session) -> None:
    repo = _make_repo(
        db,
        repo_id="repo-other",
        full_name="acme/other",
        name="other",
    )
    _make_pr(db, pr_id="pr-other", repository_id=repo.id, repo_label="other")
    db.commit()

    items = pr_repo.list_pull_requests(db, repo="wrong/acme")
    assert items == []


def test_api_pull_requests_repo_id_query(client: TestClient, db: Session) -> None:
    repo = _make_repo(
        db,
        repo_id="repo-api",
        full_name="acme/api-repo",
        name="api-repo",
    )
    _make_pr(
        db,
        pr_id="pr-api",
        repository_id=repo.id,
        repo_label="api-repo",
    )
    db.commit()

    r = client.get("/api/pull-requests", params={"repoId": "repo-api"})
    assert r.status_code == 200
    ids = {item["id"] for item in r.json()["items"]}
    assert "pr-api" in ids

    r2 = client.get("/api/pull-requests", params={"repo": "acme/api-repo"})
    assert r2.status_code == 200
    ids2 = {item["id"] for item in r2.json()["items"]}
    assert "pr-api" in ids2
