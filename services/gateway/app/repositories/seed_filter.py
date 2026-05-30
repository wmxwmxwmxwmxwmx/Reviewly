"""Exclude demo/seed rows from production API queries."""
from __future__ import annotations

from sqlalchemy import and_, func, not_, or_
from sqlalchemy.orm import Query
from sqlalchemy.sql import Select

from app.db.models import GovernanceRule, PullRequest, Repository, User
from app.mock.seed import DEFAULT_PR_ID

LEGACY_SEED_REPOSITORY_IDS: frozenset[str] = frozenset({"repo-payment", "repo-auth"})
LEGACY_SEED_PULL_REQUEST_IDS: frozenset[str] = frozenset({DEFAULT_PR_ID})
LEGACY_SEED_USER_IDS: frozenset[str] = frozenset({"u1"})
LEGACY_SEED_GOVERNANCE_RULE_IDS: frozenset[str] = frozenset({"g1"})

SOURCE_TYPE_GITHUB = "github"
SOURCE_TYPE_EXTERNAL = "external"


def is_connected_repository(row: Repository) -> bool:
    return row.source_type in (None, SOURCE_TYPE_GITHUB)


def is_external_repository(row: Repository) -> bool:
    return row.source_type == SOURCE_TYPE_EXTERNAL


def connected_repository_predicate():
    """SQLAlchemy expression: connected (OAuth-owned) repository asset."""
    return or_(Repository.source_type == SOURCE_TYPE_GITHUB, Repository.source_type.is_(None))


def external_repository_predicate():
    return Repository.source_type == SOURCE_TYPE_EXTERNAL


def only_connected_repositories(statement: Select) -> Select:
    return statement.where(connected_repository_predicate())


def only_external_repositories(statement: Select) -> Select:
    return statement.where(external_repository_predicate())


def only_connected_findings(statement: Select) -> Select:
    """Apply to selects that already join PullRequest and Repository."""
    return statement.where(connected_repository_predicate())


def is_seed_repository(row: Repository) -> bool:
    if row.source in ("test", "github"):
        return False
    if row.source == "seed":
        return True
    return row.source is None and row.id in LEGACY_SEED_REPOSITORY_IDS


def is_seed_pull_request(row: PullRequest, *, repo: Repository | None = None) -> bool:
    if repo is not None:
        return is_seed_repository(repo)
    if row.id in LEGACY_SEED_PULL_REQUEST_IDS:
        return row.repository_id in LEGACY_SEED_REPOSITORY_IDS
    return row.repository_id in LEGACY_SEED_REPOSITORY_IDS


def is_seed_repository_id(repository_id: str) -> bool:
    return repository_id in LEGACY_SEED_REPOSITORY_IDS


def is_seed_user(row: User) -> bool:
    return row.email.endswith("@acme.local")


def seed_repository_predicate():
    """SQLAlchemy expression: row is demo seed data (explicit seed or legacy id with no source)."""
    return or_(
        func.coalesce(Repository.source, "") == "seed",
        and_(
            Repository.source.is_(None),
            Repository.id.in_(tuple(LEGACY_SEED_REPOSITORY_IDS)),
        ),
    )


def seed_pull_request_predicate():
    """SQLAlchemy expression: PullRequest belongs to a demo seed repository."""
    return PullRequest.repository_id.in_(tuple(LEGACY_SEED_REPOSITORY_IDS))


def seed_governance_rule_predicate():
    """SQLAlchemy expression: legacy demo governance rules."""
    return GovernanceRule.id.in_(tuple(LEGACY_SEED_GOVERNANCE_RULE_IDS))


def seed_user_predicate():
    """SQLAlchemy expression: User is demo seed data."""
    return User.email.like("%@acme.local")


def exclude_seed_repositories(statement: Select) -> Select:
    return statement.where(not_(seed_repository_predicate()))


def exclude_seed_repositories_query(query: Query) -> Query:
    return query.filter(not_(seed_repository_predicate()))


def exclude_seed_findings(statement: Select) -> Select:
    """Apply to selects that already join PullRequest and Repository."""
    return statement.where(not_(seed_repository_predicate()))
