"""Exclude demo/seed rows from production API queries."""
from __future__ import annotations

from sqlalchemy import and_, not_, or_
from sqlalchemy.orm import Query
from sqlalchemy.sql import Select

from app.db.models import PullRequest, Repository
from app.mock.seed import DEFAULT_PR_ID

LEGACY_SEED_REPOSITORY_IDS: frozenset[str] = frozenset({"repo-payment", "repo-auth"})
LEGACY_SEED_PULL_REQUEST_IDS: frozenset[str] = frozenset({DEFAULT_PR_ID})


def is_seed_repository(row: Repository) -> bool:
    if row.source == "seed":
        return True
    return row.source is None and row.id in LEGACY_SEED_REPOSITORY_IDS


def is_seed_pull_request(row: PullRequest) -> bool:
    if row.id in LEGACY_SEED_PULL_REQUEST_IDS:
        return True
    return False


def seed_repository_predicate():
    """SQLAlchemy expression: row is demo seed data."""
    return or_(
        Repository.source == "seed",
        and_(
            Repository.source.is_(None),
            Repository.id.in_(tuple(LEGACY_SEED_REPOSITORY_IDS)),
        ),
    )


def exclude_seed_repositories(statement: Select) -> Select:
    return statement.where(not_(seed_repository_predicate()))


def exclude_seed_repositories_query(query: Query) -> Query:
    return query.filter(not_(seed_repository_predicate()))
