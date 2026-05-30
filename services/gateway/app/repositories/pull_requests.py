from __future__ import annotations

from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import PullRequest, PullRequestDiff, Repository
from app.repositories.seed_filter import (
    LEGACY_SEED_PULL_REQUEST_IDS,
    SOURCE_TYPE_GITHUB,
    exclude_seed_repositories,
    is_seed_pull_request,
    is_seed_repository,
    only_connected_repositories,
)


def list_pull_requests(
    session: Session,
    *,
    repo: str | None = None,
    risk: str | None = None,
    author: str | None = None,
    state: str | None = None,
    include_external: bool = False,
) -> list[dict]:
    stmt = exclude_seed_repositories(
        select(PullRequest).join(Repository, PullRequest.repository_id == Repository.id)
    )
    if not include_external:
        stmt = only_connected_repositories(stmt)
    rows = session.scalars(stmt).all()
    if rows:
        repo_map = {
            r.id: r
            for r in session.scalars(
                select(Repository).where(
                    Repository.id.in_({row.repository_id for row in rows})
                )
            ).all()
        }
        rows = [
            r
            for r in rows
            if not is_seed_pull_request(r, repo=repo_map.get(r.repository_id))
        ]
    items = [_pr_dict(r, repo=repo_map.get(r.repository_id)) for r in rows]
    if repo:
        items = [p for p in items if repo in p.get("repo", "")]
    if risk:
        items = [p for p in items if p.get("riskLevel") == risk]
    if author:
        items = [p for p in items if author.lower() in p.get("author", "").lower()]
    if state:
        items = [p for p in items if p.get("state") == state]
    return items


def find_by_repo_number(session: Session, owner: str, repo: str, number: int) -> str | None:
    full_name = f"{owner}/{repo}"
    row = session.scalar(
        exclude_seed_repositories(
            select(PullRequest.id)
            .join(Repository, PullRequest.repository_id == Repository.id)
            .where(Repository.full_name == full_name, PullRequest.number == number)
        ).limit(1)
    )
    if row is None:
        return None
    pr_row = session.get(PullRequest, row)
    if pr_row is None:
        return None
    if pr_row.id in LEGACY_SEED_PULL_REQUEST_IDS:
        return None
    repo_row = session.get(Repository, pr_row.repository_id)
    if repo_row is not None and is_seed_pull_request(pr_row, repo=repo_row):
        return None
    return row


def get_pull_request(session: Session, pr_id: str) -> dict | None:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return None
    repo = session.get(Repository, row.repository_id)
    if repo is not None and (is_seed_repository(repo) or is_seed_pull_request(row, repo=repo)):
        return None
    return _pr_dict(row, repo=repo)


def get_diff(session: Session, pr_id: str) -> list[dict]:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return []
    repo = session.get(Repository, row.repository_id)
    if repo is not None and (is_seed_repository(repo) or is_seed_pull_request(row, repo=repo)):
        return []
    diff_row = session.get(PullRequestDiff, pr_id)
    if diff_row is None:
        return []
    return deepcopy(diff_row.files)


def get_ai_summary(session: Session, pr_id: str) -> dict | None:
    row = session.get(PullRequest, pr_id)
    if row is None or not row.payload:
        return None
    raw = row.payload.get("aiSummary")
    if not isinstance(raw, dict) or not raw.get("content"):
        return None
    return deepcopy(raw)


def save_ai_summary(session: Session, pr_id: str, summary: dict) -> dict | None:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return None
    payload = deepcopy(row.payload) if row.payload else {}
    payload["aiSummary"] = summary
    row.payload = payload
    session.commit()
    return deepcopy(summary)


def upsert_pull_request(
    session: Session,
    *,
    pr_id: str,
    repository_id: str,
    number: int,
    github_id: str,
    state: str,
    risk_score: int,
    payload: dict,
    diff_files: list[dict] | None = None,
    patch: str | None = None,
) -> PullRequest:
    row = session.get(PullRequest, pr_id)
    if row is None:
        row = PullRequest(
            id=pr_id,
            repository_id=repository_id,
            number=number,
            github_id=github_id,
            state=state,
            risk_score=risk_score,
            payload=payload,
        )
        session.add(row)
    else:
        row.state = state
        row.risk_score = risk_score
        row.payload = payload

    if diff_files is not None or patch is not None:
        diff_row = session.get(PullRequestDiff, pr_id)
        if diff_row is None:
            diff_row = PullRequestDiff(
                pull_request_id=pr_id,
                files=diff_files or [],
                patch=patch,
            )
            session.add(diff_row)
        else:
            if diff_files is not None:
                diff_row.files = diff_files
            if patch is not None:
                diff_row.patch = patch

    session.flush()
    return row


def _pr_dict(row: PullRequest, repo: Repository | None = None) -> dict:
    if row.payload:
        data = deepcopy(row.payload)
    else:
        data = {
            "id": row.id,
            "repoId": row.repository_id,
            "number": row.number,
            "state": row.state,
            "riskScore": row.risk_score,
        }
    if repo is not None:
        data["sourceType"] = repo.source_type or SOURCE_TYPE_GITHUB
    return data
