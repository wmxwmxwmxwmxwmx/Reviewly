"""Remove repository from management (DELETE /api/repos/{id})."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    AnalysisFinding,
    AnalysisJob,
    AuthUser,
    PullRequest,
    Repository,
    Team,
    TeamMembership,
)
from app.repositories import auth_users as auth_users_repo
from app.repositories.seed_filter import SOURCE_TYPE_EXTERNAL, SOURCE_TYPE_GITHUB
from app.services import repo_sync


def _bypass_user(db: Session) -> AuthUser:
    return auth_users_repo.get_or_create_bypass_user(db)


def _insert_repo(
    session: Session,
    *,
    repo_id: str,
    full_name: str,
    source_type: str = SOURCE_TYPE_GITHUB,
    owner_user_id: str | None = None,
    visibility: str | None = "private",
    team_id: str | None = None,
) -> Repository:
    owner, name = full_name.split("/", 1)
    row = Repository(
        id=repo_id,
        full_name=full_name,
        owner=owner,
        name=name,
        github_id=repo_id.removeprefix("repo-"),
        source_type=source_type,
        source="test",
        owner_user_id=owner_user_id,
        visibility=visibility,
        team_id=team_id,
        ai_review_enabled=True,
        payload={"fullName": full_name, "openPrCount": 0, "healthScore": 80},
    )
    session.add(row)
    session.flush()
    return row


def _insert_pr_with_finding(session: Session, *, repo_id: str, pr_id: str) -> None:
    session.add(
        PullRequest(
            id=pr_id,
            repository_id=repo_id,
            number=1,
            github_id=f"gh-{pr_id}",
            state="open",
            risk_score=50,
            payload={"id": pr_id, "repo": repo_id, "number": 1, "title": "test"},
        )
    )
    session.add(
        AnalysisJob(
            id=f"job-{pr_id}",
            pull_request_id=pr_id,
            status="completed",
            progress=100,
        )
    )
    session.add(
        AnalysisFinding(
            id=f"finding-{pr_id}",
            job_id=f"job-{pr_id}",
            type="security",
            severity="high",
            title="issue",
            file="src/main.py",
            line=1,
            payload={},
        )
    )
    session.commit()


def test_remove_repository_not_found(client: TestClient) -> None:
    r = client.delete("/api/repos/repo-does-not-exist")
    assert r.status_code == 404


def test_remove_repository_success(client: TestClient, db: Session) -> None:
    user = _bypass_user(db)
    repo = _insert_repo(
        db,
        repo_id="repo-rm-1",
        full_name="acme/removable",
        owner_user_id=user.id,
    )
    db.commit()

    repo_id = repo.id
    r = client.delete(f"/api/repos/{repo_id}")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "id": repo_id}

    listed = client.get("/api/repos?type=all").json()
    assert not any(x["id"] == repo_id for x in listed)
    db.expire_all()
    assert db.get(Repository, repo_id) is None


def test_remove_repository_cascades_pr_and_findings(client: TestClient, db: Session) -> None:
    user = _bypass_user(db)
    repo = _insert_repo(
        db,
        repo_id="repo-rm-2",
        full_name="acme/with-pr",
        owner_user_id=user.id,
    )
    _insert_pr_with_finding(db, repo_id=repo.id, pr_id="pr-rm-2")
    repo_id = repo.id

    r = client.delete(f"/api/repos/{repo_id}")
    assert r.status_code == 200

    db.expire_all()
    assert db.get(PullRequest, "pr-rm-2") is None
    assert db.get(AnalysisJob, "job-pr-rm-2") is None
    assert db.get(AnalysisFinding, "finding-pr-rm-2") is None


def test_remove_repository_forbidden_for_team_non_owner(client: TestClient, db: Session) -> None:
    owner = AuthUser(
        id="auth-owner",
        github_id="owner-gh",
        username="owner",
        access_token_encrypted="enc",
    )
    bypass = _bypass_user(db)
    team = Team(id="team-rm", name="Team RM")
    db.add_all([owner, team])
    db.add(TeamMembership(user_id=owner.id, team_id=team.id, role="member"))
    db.add(TeamMembership(user_id=bypass.id, team_id=team.id, role="member"))
    repo = _insert_repo(
        db,
        repo_id="repo-rm-team",
        full_name="team/shared",
        owner_user_id=owner.id,
        visibility="team",
        team_id=team.id,
    )
    db.commit()

    r = client.delete(f"/api/repos/{repo.id}")
    assert r.status_code == 403
    assert db.get(Repository, repo.id) is not None


@patch("app.services.repo_sync.fetch_user_repositories", new_callable=AsyncMock)
@patch("app.services.repo_sync._user_token", return_value="fake-token")
def test_remove_connected_repo_restored_by_sync(
    _mock_token: AsyncMock,
    mock_fetch: AsyncMock,
    client: TestClient,
    db: Session,
) -> None:
    user = _bypass_user(db)
    repo = _insert_repo(
        db,
        repo_id="repo-999001",
        full_name="test-org/restored",
        owner_user_id=user.id,
        source_type=SOURCE_TYPE_GITHUB,
    )
    db.commit()

    repo_id = repo.id
    delete = client.delete(f"/api/repos/{repo_id}")
    assert delete.status_code == 200
    db.expire_all()
    assert db.get(Repository, repo_id) is None

    mock_fetch.return_value = [
        {
            "id": 999001,
            "full_name": "test-org/restored",
            "name": "restored",
            "owner": {"login": "test-org"},
            "default_branch": "main",
            "private": False,
        }
    ]
    sync = client.post("/api/repos/sync/me")
    assert sync.status_code == 200

    row = db.scalar(select(Repository).where(Repository.full_name == "test-org/restored"))
    assert row is not None
    assert row.source_type == SOURCE_TYPE_GITHUB


@patch("app.api.v1.repos.repo_sync.import_repository_from_url", new_callable=AsyncMock)
def test_remove_external_repo_restored_by_import(
    mock_import: AsyncMock,
    client: TestClient,
    db: Session,
) -> None:
    user = _bypass_user(db)
    repo = _insert_repo(
        db,
        repo_id="repo-ext-rm",
        full_name="obra/superpowers",
        owner_user_id=user.id,
        source_type=SOURCE_TYPE_EXTERNAL,
    )
    db.commit()

    repo_id = repo.id
    delete = client.delete(f"/api/repos/{repo_id}")
    assert delete.status_code == 200
    db.expire_all()
    assert db.get(Repository, repo_id) is None

    mock_import.return_value = {
        "id": "repo-ext-rm",
        "fullName": "obra/superpowers",
        "owner": "obra",
        "name": "superpowers",
        "defaultBranch": "main",
        "openPrCount": 0,
        "healthScore": 80,
        "lastSyncTime": "2026-01-01T00:00:00Z",
        "aiReviewEnabled": True,
        "sourceType": SOURCE_TYPE_EXTERNAL,
    }
    imported = client.post(
        "/api/repos/import",
        json={"url": "https://github.com/obra/superpowers"},
    )
    assert imported.status_code == 200
    mock_import.assert_called_once()
