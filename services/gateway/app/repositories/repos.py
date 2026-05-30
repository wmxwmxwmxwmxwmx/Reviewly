from __future__ import annotations

import logging
import shutil
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.db.models import (
    ActivityEvent,
    AnalysisFinding,
    AnalysisJob,
    GovernanceViolation,
    PullRequest,
    PullRequestDiff,
    PullRequestFile,
    Repository,
    RepositoryJob,
)

logger = logging.getLogger(__name__)
from app.repositories.ai_persisted import extract_from_settings
from app.repositories.seed_filter import (
    REPOSITORY_TYPE_EXTERNAL,
    REPOSITORY_TYPE_MANAGED,
    REPOSITORY_TYPE_OWNED,
    SOURCE_TYPE_EXTERNAL,
    SOURCE_TYPE_GITHUB,
    exclude_seed_repositories,
    is_seed_repository,
    only_external_repositories,
    only_stats_eligible_repositories,
)
from app.services.repo_health import compute_repo_health


def _split_full_name(full_name: str) -> tuple[str, str]:
    if "/" in full_name:
        owner, name = full_name.split("/", 1)
        return owner, name
    return "", full_name


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _dt_to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")


def get_repository_by_full_name(session: Session, full_name: str) -> Repository | None:
    row = session.scalar(select(Repository).where(Repository.full_name == full_name).limit(1))
    return row


def get_repository_by_github_id(session: Session, github_id: str) -> Repository | None:
    return session.scalar(select(Repository).where(Repository.github_id == github_id).limit(1))


def _apply_source_type(row: Repository, metadata: dict[str, Any], *, created: bool) -> None:
    source_type = metadata.get("source_type")
    if source_type is None:
        if created and row.source_type is None:
            row.source_type = SOURCE_TYPE_GITHUB
        return
    if created:
        row.source_type = source_type
    elif source_type == SOURCE_TYPE_GITHUB:
        row.source_type = SOURCE_TYPE_GITHUB
    # Never downgrade connected -> external on update.


def _apply_repository_type(row: Repository, metadata: dict[str, Any], *, created: bool) -> None:
    repository_type = metadata.get("repository_type")
    managed = metadata.get("managed")
    if repository_type is not None:
        if created or repository_type == REPOSITORY_TYPE_MANAGED:
            row.repository_type = repository_type
        elif repository_type == REPOSITORY_TYPE_OWNED:
            row.repository_type = REPOSITORY_TYPE_OWNED
    elif created:
        if metadata.get("source_type") == SOURCE_TYPE_EXTERNAL:
            row.repository_type = REPOSITORY_TYPE_EXTERNAL
        else:
            row.repository_type = REPOSITORY_TYPE_OWNED
    if managed is not None:
        row.managed = bool(managed)
    elif created:
        row.managed = row.repository_type != REPOSITORY_TYPE_EXTERNAL


def _apply_metadata_to_row(session: Session, row: Repository, metadata: dict[str, Any]) -> None:
    row.full_name = metadata["full_name"]
    row.github_id = metadata.get("github_id")
    row.owner = metadata.get("owner")
    row.name = metadata.get("name")
    row.description = metadata.get("description")
    row.language = metadata.get("language")
    row.stars = metadata.get("stars")
    row.forks = metadata.get("forks")
    row.open_prs = metadata.get("open_prs")
    row.default_branch = metadata.get("default_branch")
    row.clone_url = metadata.get("clone_url")
    row.html_url = metadata.get("html_url")
    row.avatar_url = metadata.get("avatar_url")
    row.is_private = metadata.get("is_private")
    row.github_created_at = metadata.get("github_created_at")
    row.github_updated_at = metadata.get("github_updated_at")
    row.pushed_at = metadata.get("pushed_at")
    row.last_synced_at = metadata.get("last_synced_at")
    if metadata.get("installation_id") is not None:
        row.installation_id = metadata.get("installation_id")
    if metadata.get("owner_user_id") is not None:
        row.owner_user_id = metadata.get("owner_user_id")
    if metadata.get("visibility") is not None:
        row.visibility = metadata.get("visibility")
    if metadata.get("source") is not None:
        row.source = metadata.get("source")
    if metadata.get("team_id") is not None:
        row.team_id = metadata.get("team_id")

    existing_payload = dict(row.payload or {})
    incoming_payload = dict(metadata.get("payload") or {})
    open_count = int(metadata.get("open_prs") or existing_payload.get("openPrCount") or 0)
    health = compute_repo_health(session, row.id, open_count)
    incoming_payload["healthScore"] = health
    incoming_payload["openPrCount"] = open_count
    incoming_payload.setdefault("aiReviewEnabled", row.ai_review_enabled)
    row.payload = {**existing_payload, **incoming_payload}


def upsert_repository(
    session: Session,
    metadata: dict[str, Any],
    *,
    installation_id: str | None = None,
) -> tuple[Repository, bool]:
    github_id = metadata.get("github_id")
    full_name = metadata["full_name"]
    repo_id = metadata["id"]

    if installation_id is not None:
        metadata = {**metadata, "installation_id": installation_id}

    row: Repository | None = None
    if github_id:
        row = get_repository_by_github_id(session, str(github_id))
    if row is None:
        row = get_repository_by_full_name(session, full_name)
    if row is None:
        row = session.get(Repository, repo_id)

    created = row is None
    if created:
        row = Repository(
            id=repo_id,
            full_name=full_name,
            installation_id=metadata.get("installation_id"),
            ai_review_enabled=True,
        )
        session.add(row)

    _apply_source_type(row, metadata, created=created)
    _apply_repository_type(row, metadata, created=created)
    _apply_metadata_to_row(session, row, metadata)
    session.flush()
    return row, created


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
    data.setdefault("name", row.name or name)
    data.setdefault("owner", row.owner or owner)
    data.setdefault("defaultBranch", row.default_branch or "main")
    data.setdefault("openPrCount", row.open_prs if row.open_prs is not None else 0)
    data.setdefault("lastSyncTime", _dt_to_iso(row.last_synced_at) or "")
    data.setdefault("aiReviewEnabled", row.ai_review_enabled)

    if row.github_id is not None:
        data["githubId"] = row.github_id
    if row.description is not None:
        data["description"] = row.description
    if row.language is not None:
        data["language"] = row.language
    if row.stars is not None:
        data["stars"] = row.stars
    if row.forks is not None:
        data["forks"] = row.forks
    if row.html_url is not None:
        data["htmlUrl"] = row.html_url
    if row.clone_url is not None:
        data["cloneUrl"] = row.clone_url
    if row.avatar_url is not None:
        data["avatarUrl"] = row.avatar_url
    if row.is_private is not None:
        data["isPrivate"] = row.is_private
    if row.pushed_at is not None:
        data["pushedAt"] = _dt_to_iso(row.pushed_at)
    if row.github_created_at is not None:
        data["githubCreatedAt"] = _dt_to_iso(row.github_created_at)
    if row.github_updated_at is not None:
        data["githubUpdatedAt"] = _dt_to_iso(row.github_updated_at)

    open_count = int(data.get("openPrCount", 0))
    if "healthScore" not in data or data.get("healthScore") == 80:
        data["healthScore"] = compute_repo_health(session, row.id, open_count)

    data["aiAnalysis"] = extract_from_settings(row.settings, "aiAnalysis")
    data["aiArchitectureAnalysis"] = extract_from_settings(row.settings, "aiArchitectureAnalysis")
    data["sourceType"] = row.source_type or SOURCE_TYPE_GITHUB
    data["repositoryType"] = row.repository_type or REPOSITORY_TYPE_OWNED
    data["managed"] = bool(row.managed)
    if row.local_path:
        data["localPath"] = row.local_path
    if row.last_cloned_at is not None:
        data["lastClonedAt"] = _dt_to_iso(row.last_cloned_at)
    if row.last_commit_sha:
        data["lastCommitSha"] = row.last_commit_sha

    from app.repositories import repository_jobs as rjob_repo

    active = rjob_repo.get_active_job_for_repo(session, row.id)
    if active:
        data["activeJob"] = active
    return data


def claim_orphan_repositories(
    session: Session,
    user_id: str,
    *,
    github_full_names: set[str] | None = None,
) -> int:
    """Assign unowned non-seed repositories to the current user after sync."""
    query = exclude_seed_repositories(select(Repository)).where(Repository.owner_user_id.is_(None))
    if github_full_names is not None:
        if not github_full_names:
            return 0
        query = query.where(Repository.full_name.in_(tuple(github_full_names)))
    rows = session.scalars(query).all()
    for row in rows:
        row.owner_user_id = user_id
    if rows:
        session.flush()
    return len(rows)


def list_repos(
    session: Session,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
    repo_type: str = SOURCE_TYPE_GITHUB,
) -> list[dict]:
    from sqlalchemy import or_

    query = exclude_seed_repositories(select(Repository))
    if repo_type == SOURCE_TYPE_GITHUB:
        query = only_stats_eligible_repositories(query)
    elif repo_type == REPOSITORY_TYPE_OWNED:
        query = query.where(Repository.repository_type == REPOSITORY_TYPE_OWNED)
    elif repo_type == REPOSITORY_TYPE_MANAGED:
        query = query.where(Repository.repository_type == REPOSITORY_TYPE_MANAGED)
    elif repo_type == SOURCE_TYPE_EXTERNAL:
        query = only_external_repositories(query)
    # repo_type == "all": no source_type filter

    if user_id:
        team_ids = team_ids or []
        if repo_type == SOURCE_TYPE_EXTERNAL:
            query = query.where(Repository.owner_user_id == user_id)
        else:
            conditions = [Repository.owner_user_id == user_id]
            if team_ids:
                conditions.append(
                    (Repository.team_id.in_(team_ids)) & (Repository.visibility == "team")
                )
            query = query.where(or_(*conditions))
    rows = session.scalars(query.order_by(Repository.full_name)).all()
    return [_repo_to_api(session, r) for r in rows]


def get_repo_row_for_user(session: Session, repo_id: str, user_id: str, team_ids: list[str]) -> Repository | None:
    row = session.get(Repository, repo_id)
    if row is None:
        return None
    if is_seed_repository(row):
        return None
    if row.owner_user_id == user_id:
        return row
    if row.visibility == "team" and row.team_id and row.team_id in team_ids:
        return row
    return None


def _purge_repo_clone_cache(repo_id: str) -> None:
    cache_dir = Path(settings.prism_repo_cache_dir) / repo_id
    if not cache_dir.exists():
        return
    try:
        shutil.rmtree(cache_dir)
    except OSError as exc:
        logger.warning("Failed to purge clone cache for %s: %s", repo_id, exc)


def adopt_repository_for_user(
    session: Session,
    repo_id: str,
    user_id: str,
    team_ids: list[str],
) -> Repository | None:
    row = get_repo_row_for_user(session, repo_id, user_id, team_ids)
    if row is None:
        return None
    if row.owner_user_id not in (None, user_id):
        raise api_error("您没有权限纳管此仓库", 403)
    if row.repository_type == REPOSITORY_TYPE_MANAGED and row.managed:
        return row
    row.managed = True
    row.repository_type = REPOSITORY_TYPE_MANAGED
    if row.owner_user_id is None:
        row.owner_user_id = user_id
    session.flush()
    return row


def _delete_repository_cascade(session: Session, repo_id: str) -> None:
    session.execute(delete(RepositoryJob).where(RepositoryJob.repository_id == repo_id))
    session.execute(delete(AnalysisFinding).where(AnalysisFinding.repository_id == repo_id))
    session.execute(delete(AnalysisJob).where(AnalysisJob.repository_id == repo_id))
    pr_ids = list(
        session.scalars(select(PullRequest.id).where(PullRequest.repository_id == repo_id)).all()
    )
    if pr_ids:
        job_ids = select(AnalysisJob.id).where(AnalysisJob.pull_request_id.in_(pr_ids))
        session.execute(delete(AnalysisFinding).where(AnalysisFinding.job_id.in_(job_ids)))
        session.execute(delete(AnalysisJob).where(AnalysisJob.pull_request_id.in_(pr_ids)))
        session.execute(
            delete(GovernanceViolation).where(GovernanceViolation.pull_request_id.in_(pr_ids))
        )
        session.execute(delete(ActivityEvent).where(ActivityEvent.pull_request_id.in_(pr_ids)))
        session.execute(delete(PullRequestDiff).where(PullRequestDiff.pull_request_id.in_(pr_ids)))
        session.execute(delete(PullRequestFile).where(PullRequestFile.pull_request_id.in_(pr_ids)))
        session.execute(delete(PullRequest).where(PullRequest.id.in_(pr_ids)))
    session.execute(delete(Repository).where(Repository.id == repo_id))
    session.flush()


def delete_repository_for_user(
    session: Session,
    repo_id: str,
    user_id: str,
    team_ids: list[str],
) -> str | None:
    """Remove a repository from management. Returns full_name on success, None if not found."""
    row = get_repo_row_for_user(session, repo_id, user_id, team_ids)
    if row is None:
        return None
    if row.owner_user_id not in (None, user_id):
        raise api_error("您没有权限取消管理此仓库", 403)
    full_name = row.full_name
    _delete_repository_cascade(session, repo_id)
    _purge_repo_clone_cache(repo_id)
    return full_name


def get_repo(session: Session, repo_id: str) -> dict | None:
    row = session.get(Repository, repo_id)
    if row is None or is_seed_repository(row):
        return None
    return _repo_to_api(session, row)


def get_repo_row(session: Session, repo_id: str) -> Repository | None:
    return session.get(Repository, repo_id)


def _save_repo_settings_ai(
    session: Session,
    repo_id: str,
    settings_key: str,
    *,
    content: str,
    model: str | None = None,
    provider: str | None = None,
) -> dict | None:
    row = session.get(Repository, repo_id)
    if row is None:
        return None
    settings = dict(row.settings or {})
    blob: dict = {
        "content": content,
        "analyzedAt": _now_iso(),
    }
    if model:
        blob["model"] = model
    if provider:
        blob["provider"] = provider
    settings[settings_key] = blob
    row.settings = settings
    session.flush()
    return _repo_to_api(session, row)


def save_repo_ai_analysis(
    session: Session,
    repo_id: str,
    *,
    content: str,
    model: str | None = None,
    provider: str | None = None,
) -> dict | None:
    return _save_repo_settings_ai(
        session,
        repo_id,
        "aiAnalysis",
        content=content,
        model=model,
        provider=provider,
    )


def save_repo_architecture_analysis(
    session: Session,
    repo_id: str,
    *,
    content: str,
    model: str | None = None,
    provider: str | None = None,
) -> dict | None:
    return _save_repo_settings_ai(
        session,
        repo_id,
        "aiArchitectureAnalysis",
        content=content,
        model=model,
        provider=provider,
    )


def upsert_repo(
    session: Session,
    *,
    repo_id: str,
    full_name: str,
    installation_id: str | None = None,
    payload: dict | None = None,
    source_type: str | None = None,
    owner_user_id: str | None = None,
) -> Repository:
    """Legacy upsert used by GitHub sync/webhook paths."""
    github_id = None
    if payload and payload.get("id", "").startswith("repo-"):
        github_id = payload["id"].removeprefix("repo-")
    elif repo_id.startswith("repo-"):
        github_id = repo_id.removeprefix("repo-")

    owner, name = _split_full_name(full_name)
    metadata: dict[str, Any] = {
        "id": repo_id,
        "github_id": github_id,
        "full_name": full_name,
        "owner": payload.get("owner", owner) if payload else owner,
        "name": payload.get("name", name) if payload else name,
        "open_prs": int((payload or {}).get("openPrCount", 0)),
        "default_branch": (payload or {}).get("defaultBranch", "main"),
        "last_synced_at": datetime.now(timezone.utc),
        "payload": payload,
        "installation_id": installation_id,
    }
    if source_type is not None:
        metadata["source_type"] = source_type
    if owner_user_id is not None:
        metadata["owner_user_id"] = owner_user_id
    if source_type == SOURCE_TYPE_EXTERNAL:
        metadata["repository_type"] = REPOSITORY_TYPE_EXTERNAL
        metadata["managed"] = False
    else:
        metadata.setdefault("repository_type", REPOSITORY_TYPE_OWNED)
        metadata.setdefault("managed", True)
    row, _ = upsert_repository(session, metadata, installation_id=installation_id)
    return row


def list_recent_findings_for_repo(session: Session, repo_id: str, limit: int = 20) -> list[dict]:
    from app.repositories.seed_filter import is_seed_repository_id

    if is_seed_repository_id(repo_id):
        return []

    repo = session.get(Repository, repo_id)
    if repo is not None and is_seed_repository(repo):
        return []

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
