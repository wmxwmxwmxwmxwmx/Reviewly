from __future__ import annotations

from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import PullRequest, PullRequestDiff, Repository


def list_pull_requests(
    session: Session,
    *,
    repo: str | None = None,
    risk: str | None = None,
    author: str | None = None,
    state: str | None = None,
) -> list[dict]:
    rows = session.scalars(select(PullRequest)).all()
    items = [_pr_dict(r) for r in rows]
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
        select(PullRequest.id)
        .join(Repository, PullRequest.repository_id == Repository.id)
        .where(Repository.full_name == full_name, PullRequest.number == number)
        .limit(1)
    )
    return row


def get_pull_request(session: Session, pr_id: str) -> dict | None:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return None
    return _pr_dict(row)


def get_diff(session: Session, pr_id: str) -> list[dict]:
    diff_row = session.get(PullRequestDiff, pr_id)
    if diff_row is None:
        return []
    return deepcopy(diff_row.files)


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


def _pr_dict(row: PullRequest) -> dict:
    if row.payload:
        return deepcopy(row.payload)
    return {
        "id": row.id,
        "repoId": row.repository_id,
        "number": row.number,
        "state": row.state,
        "riskScore": row.risk_score,
    }
