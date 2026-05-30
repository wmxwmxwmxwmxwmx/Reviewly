"""Multi-account data isolation for repositories and pull requests."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import AuthUser, PullRequest, Repository
from app.repositories import auth_users as auth_users_repo
from app.repositories import pull_requests as pr_repo
from app.repositories import repos as repos_repo


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_user(session: Session, *, suffix: str) -> AuthUser:
    return auth_users_repo.upsert_from_github(
        session,
        github_id=f"gh-{suffix}",
        username=f"user-{suffix}",
        email=f"{suffix}@test.local",
        avatar_url=None,
        access_token=f"token-{suffix}",
    )


def _make_repo(session: Session, *, repo_id: str, owner_user_id: str) -> Repository:
    row = Repository(
        id=repo_id,
        full_name=f"org/{repo_id}",
        github_id=f"gid-{repo_id}",
        source_type="github",
        source="oauth",
        owner_user_id=owner_user_id,
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
    owner_user_id: str,
) -> PullRequest:
    row = PullRequest(
        id=pr_id,
        repository_id=repository_id,
        owner_user_id=owner_user_id,
        number=1,
        github_id=f"gh-pr-{pr_id}",
        state="open",
        risk_score=10,
        payload={"id": pr_id, "repo": repository_id, "number": 1, "state": "open"},
    )
    session.add(row)
    session.flush()
    return row


def test_list_repos_strict_owner_isolation(db: Session) -> None:
    user_a = _make_user(db, suffix="a")
    user_b = _make_user(db, suffix="b")
    _make_repo(db, repo_id="repo-a", owner_user_id=user_a.id)
    _make_repo(db, repo_id="repo-b", owner_user_id=user_b.id)
    _make_repo(db, repo_id="repo-orphan", owner_user_id=user_a.id)
    orphan = db.get(Repository, "repo-orphan")
    assert orphan is not None
    orphan.owner_user_id = None
    db.commit()

    repos_a = repos_repo.list_repos(db, user_id=user_a.id, team_ids=[])
    repos_b = repos_repo.list_repos(db, user_id=user_b.id, team_ids=[])

    names_a = {r["fullName"] for r in repos_a}
    names_b = {r["fullName"] for r in repos_b}

    assert "org/repo-a" in names_a
    assert "org/repo-b" not in names_a
    assert "org/repo-orphan" not in names_a
    assert "org/repo-b" in names_b
    assert "org/repo-a" not in names_b


def test_list_pull_requests_user_isolation(db: Session) -> None:
    user_a = _make_user(db, suffix="pa")
    user_b = _make_user(db, suffix="pb")
    repo_a = _make_repo(db, repo_id="repo-pa", owner_user_id=user_a.id)
    repo_b = _make_repo(db, repo_id="repo-pb", owner_user_id=user_b.id)
    _make_pr(db, pr_id="pr-a", repository_id=repo_a.id, owner_user_id=user_a.id)
    _make_pr(db, pr_id="pr-b", repository_id=repo_b.id, owner_user_id=user_b.id)
    db.commit()

    prs_a = pr_repo.list_pull_requests(db, user_id=user_a.id, team_ids=[])
    prs_b = pr_repo.list_pull_requests(db, user_id=user_b.id, team_ids=[])

    ids_a = {p["id"] for p in prs_a}
    ids_b = {p["id"] for p in prs_b}

    assert "pr-a" in ids_a
    assert "pr-b" not in ids_a
    assert "pr-b" in ids_b
    assert "pr-a" not in ids_b


def test_get_pull_request_denies_other_user(db: Session) -> None:
    user_a = _make_user(db, suffix="ga")
    user_b = _make_user(db, suffix="gb")
    repo_b = _make_repo(db, repo_id="repo-gb", owner_user_id=user_b.id)
    _make_pr(db, pr_id="pr-gb", repository_id=repo_b.id, owner_user_id=user_b.id)
    db.commit()

    assert pr_repo.get_pull_request(db, "pr-gb", user_id=user_b.id, team_ids=[]) is not None
    assert pr_repo.get_pull_request(db, "pr-gb", user_id=user_a.id, team_ids=[]) is None
