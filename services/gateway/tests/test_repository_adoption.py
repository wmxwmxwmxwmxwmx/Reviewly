"""Repository adoption, stats eligibility, and background jobs."""
from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, AuthUser, PullRequest, Repository, RepositoryJob, Team, TeamMembership
from app.repositories import auth_users as auth_users_repo
from app.repositories.seed_filter import (
    REPOSITORY_TYPE_EXTERNAL,
    REPOSITORY_TYPE_MANAGED,
    REPOSITORY_TYPE_OWNED,
    SOURCE_TYPE_EXTERNAL,
    SOURCE_TYPE_GITHUB,
)
from app.services import repo_sync


def _bypass_user(db: Session) -> AuthUser:
    return auth_users_repo.get_or_create_bypass_user(db)


def _insert_repo(
    session: Session,
    *,
    repo_id: str,
    full_name: str,
    source_type: str = SOURCE_TYPE_GITHUB,
    repository_type: str | None = None,
    managed: bool | None = None,
    owner_user_id: str | None = None,
) -> Repository:
    owner, name = full_name.split("/", 1)
    is_external = source_type == SOURCE_TYPE_EXTERNAL
    row = Repository(
        id=repo_id,
        full_name=full_name,
        owner=owner,
        name=name,
        github_id=repo_id.removeprefix("repo-"),
        source_type=source_type,
        repository_type=repository_type
        or (REPOSITORY_TYPE_EXTERNAL if is_external else REPOSITORY_TYPE_OWNED),
        managed=managed if managed is not None else not is_external,
        owner_user_id=owner_user_id,
        source="test",
        ai_review_enabled=True,
        payload={"fullName": full_name, "openPrCount": 0, "healthScore": 80},
    )
    session.add(row)
    session.flush()
    return row


def _insert_pr_with_finding(
    session: Session,
    *,
    repo_id: str,
    pr_id: str,
    finding_id: str,
    finding_type: str,
) -> None:
    repo = session.get(Repository, repo_id)
    assert repo is not None
    session.add(
        PullRequest(
            id=pr_id,
            repository_id=repo_id,
            number=1,
            github_id=f"gh-{pr_id}",
            state="open",
            risk_score=50,
            payload={
                "id": pr_id,
                "repo": repo.full_name,
                "number": 1,
                "title": "test pr",
                "author": "dev",
                "state": "open",
                "riskLevel": "medium",
            },
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
            id=finding_id,
            job_id=f"job-{pr_id}",
            type=finding_type,
            severity="high",
            title=f"{finding_type} issue",
            file="src/main.py",
            line=1,
            payload={},
        )
    )
    session.commit()


@contextmanager
def _public_import_mocks(mock_pr: dict, mock_repo: dict):
    with (
        patch(
            "app.github.import_pr.get_installation_id_for_repo",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.github.public_client.get_repo_public",
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
            return_value=[{"sha": "abc"}],
        ),
    ):
        yield


def test_pr_import_sets_external_and_unmanaged(client: TestClient, db: Session) -> None:
    mock_pr = {
        "id": 888001,
        "number": 1,
        "title": "external pr",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {
            "ref": "main",
            "repo": {"id": 888001, "full_name": "obra/superpowers", "default_branch": "main"},
        },
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/obra/superpowers/pull/1",
    }
    mock_repo = {
        "id": 888001,
        "full_name": "obra/superpowers",
        "default_branch": "main",
    }

    with _public_import_mocks(mock_pr, mock_repo):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/obra/superpowers/pull/1"},
        )

    assert r.status_code == 200
    row = db.scalar(select(Repository).where(Repository.full_name == "obra/superpowers"))
    assert row is not None
    assert row.source_type == SOURCE_TYPE_EXTERNAL
    assert row.repository_type == REPOSITORY_TYPE_EXTERNAL
    assert row.managed is False


def test_onboard_marks_managed_and_starts_job(client: TestClient, db: Session) -> None:
    user = _bypass_user(db)
    repo = _insert_repo(
        db,
        repo_id="repo-onboard-me",
        full_name="obra/onboard-test",
        source_type=SOURCE_TYPE_EXTERNAL,
        owner_user_id=user.id,
    )
    db.commit()

    with patch("app.api.v1.repository_jobs.repository_jobs_service.schedule_repository_job") as sched:
        r = client.post("/api/repos/onboard", json={"repoId": repo.id})

    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["jobId"].startswith("rjob-")
    sched.assert_called_once()

    db.expire_all()
    row = db.get(Repository, repo.id)
    assert row is not None
    assert row.managed is True
    assert row.repository_type == REPOSITORY_TYPE_MANAGED


def test_adopted_repo_survives_public_pr_reimport(client: TestClient, db: Session) -> None:
    user = _bypass_user(db)
    repo = _insert_repo(
        db,
        repo_id="repo-888001",
        full_name="obra/superpowers",
        source_type=SOURCE_TYPE_EXTERNAL,
        owner_user_id=user.id,
    )
    db.commit()

    with patch("app.api.v1.repository_jobs.repository_jobs_service.schedule_repository_job"):
        adopt = client.post(f"/api/repos/{repo.id}/adopt")
    assert adopt.status_code == 200

    mock_pr = {
        "id": 888001,
        "number": 2,
        "title": "reimport after adopt",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-02T00:00:00Z",
        "created_at": "2025-01-02T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {
            "ref": "main",
            "repo": {"id": 888001, "full_name": "obra/superpowers", "default_branch": "main"},
        },
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/obra/superpowers/pull/2",
    }
    mock_repo = {
        "id": 888001,
        "full_name": "obra/superpowers",
        "default_branch": "main",
    }

    with _public_import_mocks(mock_pr, mock_repo):
        reimport = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/obra/superpowers/pull/2"},
        )
    assert reimport.status_code == 200
    pr_id = reimport.json()["prId"]

    db.expire_all()
    row = db.get(Repository, repo.id)
    assert row is not None
    assert row.managed is True
    assert row.repository_type == REPOSITORY_TYPE_MANAGED

    repos_api = client.get("/api/repos", params={"type": "all"}).json()
    repo_api = next(r for r in repos_api if r["id"] == repo.id)
    assert repo_api["isManaged"] is True
    assert repo_api["managed"] is True
    assert repo_api["repositoryType"] == REPOSITORY_TYPE_MANAGED

    pr_api = client.get(f"/api/pull-requests/{pr_id}").json()
    assert pr_api["isManaged"] is True
    assert pr_api["managed"] is True
    assert pr_api["repositoryType"] == REPOSITORY_TYPE_MANAGED


def test_adopt_marks_managed_and_starts_job(client: TestClient, db: Session) -> None:
    user = _bypass_user(db)
    repo = _insert_repo(
        db,
        repo_id="repo-adopt-me",
        full_name="obra/superpowers",
        source_type=SOURCE_TYPE_EXTERNAL,
        owner_user_id=user.id,
    )
    db.commit()

    with patch("app.api.v1.repository_jobs.repository_jobs_service.schedule_repository_job") as sched:
        r = client.post(f"/api/repos/{repo.id}/adopt")

    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["jobId"].startswith("rjob-")
    sched.assert_called_once()

    db.expire_all()
    row = db.get(Repository, repo.id)
    assert row is not None
    assert row.managed is True
    assert row.repository_type == REPOSITORY_TYPE_MANAGED
    assert row.owner_user_id == user.id


def test_adopt_includes_findings_in_dashboard_stats(client: TestClient, db: Session) -> None:
    before = client.get("/api/dashboard").json()["securityIssues"]
    external = _insert_repo(
        db,
        repo_id="repo-ext-stats",
        full_name="obra/superpowers",
        source_type=SOURCE_TYPE_EXTERNAL,
    )
    _insert_pr_with_finding(
        db,
        repo_id=external.id,
        pr_id="pr-ext-stats",
        finding_id="sec-ext-stats",
        finding_type="security",
    )

    dash_before_adopt = client.get("/api/dashboard").json()
    assert dash_before_adopt["securityIssues"] == before

    user = _bypass_user(db)
    external.owner_user_id = user.id
    external.managed = True
    external.repository_type = REPOSITORY_TYPE_MANAGED
    db.commit()

    dash_after = client.get("/api/dashboard").json()
    assert dash_after["securityIssues"] == before + 1


def test_pure_external_still_excluded_from_stats(client: TestClient, db: Session) -> None:
    before = client.get("/api/security/stats").json()["openFindings"]
    external = _insert_repo(
        db,
        repo_id="repo-pure-ext",
        full_name="microsoft/vscode",
        source_type=SOURCE_TYPE_EXTERNAL,
    )
    _insert_pr_with_finding(
        db,
        repo_id=external.id,
        pr_id="pr-pure-ext",
        finding_id="sec-pure-ext",
        finding_type="security",
    )

    stats = client.get("/api/security/stats").json()
    assert stats["openFindings"] == before


def test_repository_job_lifecycle(db: Session) -> None:
    import asyncio

    from app.services.repository_jobs import _execute_job

    user = _bypass_user(db)
    repo = _insert_repo(
        db,
        repo_id="repo-job-life",
        full_name="team/job-life",
        owner_user_id=user.id,
    )
    db.add(
        RepositoryJob(
            id="rjob-test-1",
            repository_id=repo.id,
            job_type="security",
            status="pending",
            progress=0,
            message="queued",
        )
    )
    db.commit()

    with patch(
        "app.services.repository_jobs.repo_scan.run_security_scan",
        new_callable=AsyncMock,
        return_value=2,
    ):
        asyncio.run(_execute_job(db, "rjob-test-1"))

    db.expire_all()
    job = db.get(RepositoryJob, "rjob-test-1")
    assert job is not None
    assert job.status == "success"
    assert job.progress == 100


def test_clone_cache_skips_when_sha_matches(db: Session, tmp_path) -> None:
    import asyncio

    from app.services import repo_clone

    clone_dir = tmp_path / "clone"
    clone_dir.mkdir()
    (clone_dir / "README.md").write_text("hello")

    repo = _insert_repo(
        db,
        repo_id="repo-cache-hit",
        full_name="team/cache-hit",
        source_type=SOURCE_TYPE_GITHUB,
    )
    repo.local_path = str(clone_dir)
    repo.last_commit_sha = "abc123"
    db.commit()

    with (
        patch(
            "app.services.repo_clone.fetch_remote_head_sha",
            new_callable=AsyncMock,
            return_value="abc123",
        ),
        patch("app.services.repo_clone._resolve_token", new_callable=AsyncMock, return_value="tok"),
        patch("app.services.repo_clone._run_git") as git_run,
    ):
        result = asyncio.run(repo_clone.ensure_repo_clone(db, repo.id))

    assert result.get("cached") is True
    git_run.assert_not_called()


def test_adopt_forbidden_for_other_owner(client: TestClient, db: Session) -> None:
    owner = AuthUser(
        id="auth-other",
        github_id="111",
        username="other",
        access_token_encrypted="enc",
    )
    bypass = _bypass_user(db)
    team = Team(id="team-adopt", name="Adopt Team")
    membership = TeamMembership(user_id=bypass.id, team_id=team.id)
    db.add(owner)
    db.add(team)
    db.add(membership)
    repo = _insert_repo(
        db,
        repo_id="repo-forbidden",
        full_name="other/private",
        source_type=SOURCE_TYPE_EXTERNAL,
        owner_user_id=owner.id,
    )
    repo.visibility = "team"
    repo.team_id = team.id
    db.commit()

    r = client.post(f"/api/repos/{repo.id}/adopt")
    assert r.status_code == 403


def test_oauth_sync_sets_owned_managed(db: Session) -> None:
    import asyncio

    gh_repo = {
        "id": 654321,
        "full_name": "my-org/service",
        "name": "service",
        "owner": {"login": "my-org"},
        "default_branch": "main",
        "private": False,
    }
    user = AuthUser(
        id="auth-u2",
        github_id="888",
        username="dev2",
        access_token_encrypted="enc",
    )
    db.add(user)
    db.commit()

    with patch(
        "app.services.repo_sync.fetch_user_repositories",
        new_callable=AsyncMock,
        return_value=[gh_repo],
    ), patch("app.services.repo_sync._user_token", return_value="token"):
        asyncio.run(repo_sync.sync_repositories_for_user(db, user))

    row = db.scalar(select(Repository).where(Repository.full_name == "my-org/service"))
    assert row is not None
    assert row.source_type == SOURCE_TYPE_GITHUB
    assert row.repository_type == REPOSITORY_TYPE_OWNED
    assert row.managed is True
