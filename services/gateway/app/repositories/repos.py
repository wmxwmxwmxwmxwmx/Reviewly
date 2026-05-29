from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AnalysisFinding, AnalysisJob, PullRequest, Repository
from app.services.repo_health import compute_repo_health


def _split_full_name(full_name: str) -> tuple[str, str]:
    if "/" in full_name:
        owner, name = full_name.split("/", 1)
        return owner, name
    return "", full_name


def _repo_to_api(session: Session, row: Repository) -> dict:
    if row.payload:
        data = deepcopy(row.payload)
    else:
        owner, name = _split_full_name(row.full_name)
        data = {
            "id": row.id,
            "fullName": row.full_name,
            "name": name,
            "owner": owner,
            "defaultBranch": "main",
            "openPrCount": 0,
            "healthScore": 80,
            "lastSyncTime": "",
            "aiReviewEnabled": row.ai_review_enabled,
        }

    data["id"] = row.id
    data.setdefault("fullName", row.full_name)
    owner, name = _split_full_name(data.get("fullName", row.full_name))
    data.setdefault("name", name)
    data.setdefault("owner", owner)
    data.setdefault("defaultBranch", "main")
    data.setdefault("openPrCount", 0)
    data.setdefault("lastSyncTime", "")
    data.setdefault("aiReviewEnabled", row.ai_review_enabled)

    open_count = int(data.get("openPrCount", 0))
    if "healthScore" not in data or data.get("healthScore") == 80:
        data["healthScore"] = compute_repo_health(session, row.id, open_count)

    return data


def list_repos(session: Session) -> list[dict]:
    rows = session.scalars(select(Repository).order_by(Repository.full_name)).all()
    return [_repo_to_api(session, r) for r in rows]


def get_repo(session: Session, repo_id: str) -> dict | None:
    row = session.get(Repository, repo_id)
    if row is None:
        return None
    return _repo_to_api(session, row)


def get_repo_row(session: Session, repo_id: str) -> Repository | None:
    return session.get(Repository, repo_id)


def upsert_repo(
    session: Session,
    *,
    repo_id: str,
    full_name: str,
    installation_id: str | None = None,
    payload: dict | None = None,
) -> Repository:
    row = session.get(Repository, repo_id)
    if row is None:
        row = Repository(
            id=repo_id,
            full_name=full_name,
            installation_id=installation_id,
            payload=payload,
        )
        session.add(row)
    else:
        row.full_name = full_name
        if installation_id is not None:
            row.installation_id = installation_id
        if payload is not None:
            row.payload = payload
    session.flush()
    return row


def list_recent_findings_for_repo(session: Session, repo_id: str, limit: int = 20) -> list[dict]:
    pr_ids = session.scalars(
        select(PullRequest.id).where(PullRequest.repository_id == repo_id)
    ).all()
    if not pr_ids:
        return []

    rows = session.scalars(
        select(AnalysisFinding)
        .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
        .where(AnalysisJob.pull_request_id.in_(pr_ids))
        .order_by(AnalysisFinding.id.desc())
        .limit(limit)
    ).all()

    from app.repositories.analysis import _finding_to_api

    return [_finding_to_api(r) for r in rows]
