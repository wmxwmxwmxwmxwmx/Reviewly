"""Repository source_type isolation (connected vs external)."""
from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, AuthUser, PullRequest, Repository
from app.repositories.seed_filter import (
    REPOSITORY_TYPE_EXTERNAL,
    REPOSITORY_TYPE_OWNED,
    SOURCE_TYPE_EXTERNAL,
    SOURCE_TYPE_GITHUB,
)
from app.services import repo_sync


def _insert_repo(
    session: Session,
    *,
    repo_id: str,
    full_name: str,
    source_type: str = SOURCE_TYPE_GITHUB,
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
        repository_type=REPOSITORY_TYPE_EXTERNAL if is_external else REPOSITORY_TYPE_OWNED,
        managed=not is_external,
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


def test_oauth_sync_sets_source_type_github(db: Session) -> None:
    import asyncio

    gh_repo = {
        "id": 123456,
        "full_name": "my-org/backend",
        "name": "backend",
        "owner": {"login": "my-org"},
        "default_branch": "main",
        "private": False,
    }

    user = AuthUser(
        id="auth-u1",
        github_id="999",
        username="dev",
        access_token_encrypted="enc",
    )
    db.add(user)
    db.commit()

    with patch(
        "app.services.repo_sync.fetch_user_repositories",
        new_callable=AsyncMock,
        return_value=[gh_repo],
    ), patch(
        "app.services.repo_sync._user_token",
        return_value="fake-token",
    ):
        result = asyncio.run(repo_sync.sync_repositories_for_user(db, user))

    assert result["synced"] == 1
    row = db.scalar(select(Repository).where(Repository.full_name == "my-org/backend"))
    assert row is not None
    assert row.source_type == SOURCE_TYPE_GITHUB
    assert row.repository_type == REPOSITORY_TYPE_OWNED
    assert row.managed is True


def test_pr_import_creates_external_repository(client: TestClient, db: Session) -> None:
    mock_pr = {
        "id": 999010,
        "number": 1,
        "title": "external pr",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {
            "ref": "main",
            "repo": {"id": 999010, "full_name": "obra/superpowers", "default_branch": "main"},
        },
        "additions": 1,
        "deletions": 0,
        "changed_files": 1,
        "html_url": "https://github.com/obra/superpowers/pull/1",
    }
    mock_repo = {
        "id": 999010,
        "full_name": "obra/superpowers",
        "default_branch": "main",
    }

    with _public_import_mocks(mock_pr, mock_repo):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/obra/superpowers/pull/1"},
        )

    assert r.status_code == 200
    body = r.json()
    assert body["repositoryCreated"] is True
    assert body["repoId"] == "repo-999010"
    assert body["prId"].startswith("pr-")
    row = db.scalar(select(Repository).where(Repository.full_name == "obra/superpowers"))
    assert row is not None
    assert row.source_type == SOURCE_TYPE_EXTERNAL
    assert row.repository_type == REPOSITORY_TYPE_EXTERNAL
    assert row.managed is False


def test_dashboard_excludes_external_findings(client: TestClient, db: Session) -> None:
    before = client.get("/api/dashboard").json()["securityIssues"]
    connected = _insert_repo(db, repo_id="repo-connected", full_name="team/backend")
    external = _insert_repo(
        db,
        repo_id="repo-external",
        full_name="obra/superpowers",
        source_type=SOURCE_TYPE_EXTERNAL,
    )
    _insert_pr_with_finding(
        db,
        repo_id=connected.id,
        pr_id="pr-connected",
        finding_id="sec-connected",
        finding_type="security",
    )
    _insert_pr_with_finding(
        db,
        repo_id=external.id,
        pr_id="pr-external",
        finding_id="sec-external",
        finding_type="security",
    )

    dash = client.get("/api/dashboard").json()
    assert dash["securityIssues"] == before + 1
    assert dash["summary"]["securityCount"] == before + 1


def test_security_stats_exclude_external(client: TestClient, db: Session) -> None:
    before = client.get("/api/security/stats").json()["openFindings"]
    connected = _insert_repo(db, repo_id="repo-sec-a", full_name="team/api")
    external = _insert_repo(
        db,
        repo_id="repo-sec-b",
        full_name="microsoft/vscode",
        source_type=SOURCE_TYPE_EXTERNAL,
    )
    _insert_pr_with_finding(
        db,
        repo_id=connected.id,
        pr_id="pr-sec-a",
        finding_id="sec-a",
        finding_type="security",
    )
    _insert_pr_with_finding(
        db,
        repo_id=external.id,
        pr_id="pr-sec-b",
        finding_id="sec-b",
        finding_type="security",
    )

    stats = client.get("/api/security/stats").json()
    assert stats["openFindings"] == before + 1


def test_performance_stats_exclude_external(client: TestClient, db: Session) -> None:
    before = client.get("/api/performance/stats").json()["openFindings"]
    connected = _insert_repo(db, repo_id="repo-perf-a", full_name="team/web")
    external = _insert_repo(
        db,
        repo_id="repo-perf-b",
        full_name="facebook/react",
        source_type=SOURCE_TYPE_EXTERNAL,
    )
    _insert_pr_with_finding(
        db,
        repo_id=connected.id,
        pr_id="pr-perf-a",
        finding_id="perf-a",
        finding_type="performance",
    )
    _insert_pr_with_finding(
        db,
        repo_id=external.id,
        pr_id="pr-perf-b",
        finding_id="perf-b",
        finding_type="performance",
    )

    stats = client.get("/api/performance/stats").json()
    assert stats["openFindings"] == before + 1


def test_external_pr_still_accessible_for_ai_review(client: TestClient, db: Session) -> None:
    external = _insert_repo(
        db,
        repo_id="repo-review",
        full_name="obra/superpowers",
        source_type=SOURCE_TYPE_EXTERNAL,
    )
    db.add(
        PullRequest(
            id="pr-review-ext",
            repository_id=external.id,
            number=1,
            github_id="gh-review-ext",
            state="open",
            risk_score=40,
            payload={
                "id": "pr-review-ext",
                "repo": external.full_name,
                "number": 1,
                "title": "external review",
                "author": "dev",
                "state": "open",
                "riskLevel": "medium",
                "sourceBranch": "feat",
                "targetBranch": "main",
            },
        )
    )
    db.commit()

    detail = client.get("/api/pull-requests/pr-review-ext")
    assert detail.status_code == 200
    assert detail.json()["sourceType"] == SOURCE_TYPE_EXTERNAL

    analysis = client.post("/api/pull-requests/pr-review-ext/analysis")
    assert analysis.status_code == 200
    assert "jobId" in analysis.json()
