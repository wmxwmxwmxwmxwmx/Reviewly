"""Tests for per-file PR persistence and governance builtins."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.repositories import pull_request_files as pr_files_repo
from app.repositories import governance as governance_repo
from app.services.governance_evaluator import evaluate_rule


def test_map_github_file() -> None:
    mapped = pr_files_repo.map_github_file(
        {
            "filename": "src/main.py",
            "patch": "@@ -1 +1 @@\n+x",
            "additions": 1,
            "deletions": 0,
            "status": "modified",
        }
    )
    assert mapped["filename"] == "src/main.py"
    assert mapped["additions"] == 1


def test_missing_tests_rule_violation() -> None:
    rule = {
        "id": "gov-missing-tests",
        "rule": "需要测试",
        "matchType": "missing_tests",
    }
    result = evaluate_rule(
        rule,
        patch="",
        file_paths=["src/app.py"],
        findings=[],
    )
    assert result.violated is True


def test_large_pr_rule() -> None:
    rule = {
        "id": "gov-large-pr",
        "rule": "超大 PR",
        "matchType": "large_pr",
        "maxLines": 10,
        "maxFiles": 2,
    }
    result = evaluate_rule(
        rule,
        patch="",
        file_paths=["a.py", "b.py", "c.py"],
        findings=[],
        pr_meta={"additions": 100, "deletions": 50},
    )
    assert result.violated is True


def test_import_persists_files(client: TestClient) -> None:
    mock_pr = {
        "id": 777001,
        "number": 7,
        "title": "feat",
        "state": "open",
        "user": {"login": "dev"},
        "updated_at": "2025-01-01T00:00:00Z",
        "created_at": "2025-01-01T00:00:00Z",
        "head": {"ref": "feat"},
        "base": {"ref": "main", "repo": {"id": 888}},
        "additions": 3,
        "deletions": 1,
        "changed_files": 1,
        "html_url": "https://github.com/octocat/Hello-World/pull/7",
    }
    mock_repo = {"id": 888, "full_name": "octocat/Hello-World", "default_branch": "main"}
    mock_files = [
        {
            "filename": "README.md",
            "patch": "@@ -1 +1 @@\n+line",
            "additions": 1,
            "deletions": 0,
            "status": "modified",
        }
    ]

    with (
        patch(
            "app.integrations.github.app_auth.get_installation_id_for_repo",
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
            return_value="diff --git a/README.md b/README.md\n",
        ),
        patch(
            "app.github.public_client.list_pull_files",
            new_callable=AsyncMock,
            return_value=mock_files,
        ),
        patch(
            "app.github.public_client.list_pull_commits",
            new_callable=AsyncMock,
            return_value=[{"sha": "abc"}],
        ),
    ):
        r = client.post(
            "/api/pull-requests/import",
            json={"url": "https://github.com/octocat/Hello-World/pull/7"},
        )

    assert r.status_code == 200
    pr_id = r.json()["prId"]
    files = client.get(f"/api/pull-requests/{pr_id}/files").json()
    assert len(files) == 1
    assert files[0]["filename"] == "README.md"


def test_builtin_governance_rules_seeded() -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.db.models import Base, GovernanceRule

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        assert session.scalar(select(GovernanceRule.id).limit(1)) is None  # type: ignore[name-defined]
        governance_repo.ensure_builtin_rules(session)
        session.commit()
        rules = governance_repo.list_rule_definitions(session, include_disabled=True)
        ids = {r["id"] for r in rules}
        assert "gov-missing-tests" in ids
        assert "gov-large-pr" in ids
