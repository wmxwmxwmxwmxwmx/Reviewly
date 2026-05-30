from __future__ import annotations

from copy import deepcopy

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.db.models import (
    ActivityEvent,
    AnalysisCacheEvent,
    AnalysisFinding,
    AnalysisJob,
    GovernanceViolation,
    PullRequest,
    PullRequestDiff,
    PullRequestFile,
    Repository,
)
from app.repositories.seed_filter import (
    LEGACY_SEED_PULL_REQUEST_IDS,
    SOURCE_TYPE_GITHUB,
    exclude_seed_repositories,
    is_seed_pull_request,
    is_seed_repository,
    only_connected_repositories,
)


def _user_pr_scope(user_id: str | None, team_ids: list[str] | None):
    if not user_id:
        return None
    team_ids = team_ids or []
    conditions = [
        PullRequest.owner_user_id == user_id,
        Repository.owner_user_id == user_id,
    ]
    if team_ids:
        conditions.append(
            (Repository.visibility == "team") & (Repository.team_id.in_(team_ids))
        )
    return or_(*conditions)


def _user_can_access_pr(
    session: Session,
    row: PullRequest,
    *,
    user_id: str | None,
    team_ids: list[str] | None,
) -> bool:
    if not user_id:
        return True
    if row.owner_user_id == user_id:
        return True
    repo = session.get(Repository, row.repository_id)
    if repo is None:
        return False
    if repo.owner_user_id == user_id:
        return True
    team_ids = team_ids or []
    return bool(
        repo.visibility == "team"
        and repo.team_id
        and repo.team_id in team_ids
    )


def _apply_repository_filter(
    stmt,
    *,
    repo: str | None,
    repo_id: str | None,
):
    if repo_id:
        return stmt.where(PullRequest.repository_id == repo_id)
    if not repo:
        return stmt
    if "/" in repo:
        return stmt.where(Repository.full_name == repo)
    return stmt.where(
        or_(
            Repository.full_name == repo,
            Repository.name == repo,
        )
    )


def filter_pull_request_items(
    items: list[dict],
    filter_name: str | None,
) -> list[dict]:
    """Dashboard / list filters: assigned (待审批), high-risk."""
    if not filter_name:
        return items
    if filter_name == "assigned":
        return [p for p in items if p.get("reviewStatus") in ("OPEN", "IN_REVIEW")]
    if filter_name in ("high-risk", "high_risk"):
        return [
            p
            for p in items
            if p.get("riskLevel") in ("critical", "high")
            and p.get("reviewStatus") not in ("MERGED", "CLOSED")
        ]
    return items


def list_pull_requests(
    session: Session,
    *,
    repo: str | None = None,
    repo_id: str | None = None,
    risk: str | None = None,
    author: str | None = None,
    state: str | None = None,
    review_status: str | None = None,
    search: str | None = None,
    include_external: bool = False,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> list[dict]:
    stmt = exclude_seed_repositories(
        select(PullRequest).join(Repository, PullRequest.repository_id == Repository.id)
    )
    if not include_external:
        stmt = only_connected_repositories(stmt)
    scope = _user_pr_scope(user_id, team_ids)
    if scope is not None:
        stmt = stmt.where(scope)
    stmt = _apply_repository_filter(stmt, repo=repo, repo_id=repo_id)
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
    else:
        repo_map = {}
    items = [_pr_dict(r, repo=repo_map.get(r.repository_id)) for r in rows]
    if risk:
        items = [p for p in items if p.get("riskLevel") == risk]
    if author:
        items = [p for p in items if author.lower() in p.get("author", "").lower()]
    if state:
        items = [p for p in items if p.get("state") == state]
    if review_status and review_status != "ALL":
        items = [p for p in items if p.get("reviewStatus") == review_status]
    if search:
        needle = search.strip().lower()
        if needle:

            def _matches(p: dict) -> bool:
                haystack = " ".join(
                    [
                        str(p.get("title") or ""),
                        str(p.get("displayName") or ""),
                        str(p.get("repo") or ""),
                        str(p.get("author") or ""),
                        str(p.get("number") or ""),
                    ]
                ).lower()
                return needle in haystack

            items = [p for p in items if _matches(p)]
    items.sort(key=lambda p: p.get("updatedAt") or "", reverse=True)
    items.sort(key=lambda p: not bool(p.get("favorite")))
    return items


def find_by_repo_number(
    session: Session,
    owner: str,
    repo: str,
    number: int,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> str | None:
    full_name = f"{owner}/{repo}"
    stmt = exclude_seed_repositories(
        select(PullRequest.id)
        .join(Repository, PullRequest.repository_id == Repository.id)
        .where(Repository.full_name == full_name, PullRequest.number == number)
    )
    scope = _user_pr_scope(user_id, team_ids)
    if scope is not None:
        stmt = stmt.where(scope)
    row = session.scalar(stmt.limit(1))
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


def get_pull_request(
    session: Session,
    pr_id: str,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> dict | None:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return None
    repo = session.get(Repository, row.repository_id)
    if repo is not None and (is_seed_repository(repo) or is_seed_pull_request(row, repo=repo)):
        return None
    if user_id and not _user_can_access_pr(session, row, user_id=user_id, team_ids=team_ids):
        return None
    return _pr_dict(row, repo=repo)


def get_diff(
    session: Session,
    pr_id: str,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> list[dict]:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return []
    repo = session.get(Repository, row.repository_id)
    if repo is not None and (is_seed_repository(repo) or is_seed_pull_request(row, repo=repo)):
        return []
    if user_id and not _user_can_access_pr(session, row, user_id=user_id, team_ids=team_ids):
        return []
    diff_row = session.get(PullRequestDiff, pr_id)
    if diff_row is None:
        return []
    return deepcopy(diff_row.files)


def get_ai_summary(
    session: Session,
    pr_id: str,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> dict | None:
    row = session.get(PullRequest, pr_id)
    if row is None or not row.payload:
        return None
    if user_id and not _user_can_access_pr(session, row, user_id=user_id, team_ids=team_ids):
        return None
    raw = row.payload.get("aiSummary")
    if not isinstance(raw, dict) or not raw.get("content"):
        return None
    return deepcopy(raw)


def save_ai_summary(
    session: Session,
    pr_id: str,
    summary: dict,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> dict | None:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return None
    if user_id and not _user_can_access_pr(session, row, user_id=user_id, team_ids=team_ids):
        return None
    payload = deepcopy(row.payload) if row.payload else {}
    payload["aiSummary"] = summary
    row.payload = payload
    session.commit()
    return deepcopy(summary)


def update_pull_request_metadata(
    session: Session,
    pr_id: str,
    *,
    display_name: str | None = None,
    note: str | None = None,
    favorite: bool | None = None,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> dict | None:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return None
    repo = session.get(Repository, row.repository_id)
    if repo is not None and (is_seed_repository(repo) or is_seed_pull_request(row, repo=repo)):
        return None
    if user_id and not _user_can_access_pr(session, row, user_id=user_id, team_ids=team_ids):
        return None

    if display_name is not None:
        row.display_name = display_name.strip() or None
    if note is not None:
        row.note = note.strip() or None
    if favorite is not None:
        row.favorite = favorite

    session.commit()
    return _pr_dict(row, repo=repo)


def delete_pull_request(
    session: Session,
    pr_id: str,
    *,
    user_id: str | None = None,
    team_ids: list[str] | None = None,
) -> bool | str:
    row = session.get(PullRequest, pr_id)
    if row is None:
        return False
    repo = session.get(Repository, row.repository_id)
    if repo is not None and (is_seed_repository(repo) or is_seed_pull_request(row, repo=repo)):
        return "protected"
    if user_id and not _user_can_access_pr(session, row, user_id=user_id, team_ids=team_ids):
        return False

    job_ids = list(
        session.scalars(
            select(AnalysisJob.id).where(AnalysisJob.pull_request_id == pr_id)
        ).all()
    )
    if job_ids:
        session.execute(delete(AnalysisFinding).where(AnalysisFinding.job_id.in_(job_ids)))
        session.execute(delete(AnalysisCacheEvent).where(AnalysisCacheEvent.job_id.in_(job_ids)))
        session.execute(
            update(AnalysisJob)
            .where(AnalysisJob.source_job_id.in_(job_ids))
            .values(source_job_id=None)
        )
        session.execute(delete(AnalysisJob).where(AnalysisJob.id.in_(job_ids)))

    session.execute(delete(AnalysisCacheEvent).where(AnalysisCacheEvent.pull_request_id == pr_id))
    session.execute(delete(GovernanceViolation).where(GovernanceViolation.pull_request_id == pr_id))
    session.execute(delete(ActivityEvent).where(ActivityEvent.pull_request_id == pr_id))
    session.execute(delete(PullRequestFile).where(PullRequestFile.pull_request_id == pr_id))
    session.execute(delete(PullRequestDiff).where(PullRequestDiff.pull_request_id == pr_id))
    session.execute(delete(PullRequest).where(PullRequest.id == pr_id))
    session.commit()
    return True


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
    owner_user_id: str | None = None,
    head_sha: str | None = None,
    base_sha: str | None = None,
) -> PullRequest:
    from app.repositories.review_center import map_github_state_to_review_status, record_pr_created

    mapped_status = map_github_state_to_review_status(state)
    row = session.get(PullRequest, pr_id)
    is_new = row is None
    if is_new:
        row = PullRequest(
            id=pr_id,
            repository_id=repository_id,
            number=number,
            github_id=github_id,
            state=state,
            risk_score=risk_score,
            payload=payload,
            owner_user_id=owner_user_id,
            head_sha=head_sha,
            base_sha=base_sha,
            review_status=mapped_status,
        )
        session.add(row)
    else:
        row.state = state
        row.risk_score = risk_score
        row.payload = payload
        if owner_user_id is not None:
            row.owner_user_id = owner_user_id
        if head_sha is not None:
            row.head_sha = head_sha
        if base_sha is not None:
            row.base_sha = base_sha
        if mapped_status in ("MERGED", "CLOSED"):
            row.review_status = mapped_status
        elif not row.review_status:
            row.review_status = mapped_status

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
    if is_new:
        record_pr_created(session, pr_id, str(payload.get("author") or "未知作者"))
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
        data["repo"] = repo.full_name
        data["repoId"] = row.repository_id
        data["sourceType"] = repo.source_type or SOURCE_TYPE_GITHUB
        data["repositoryType"] = getattr(repo, "repository_type", None) or "owned"
        data["managed"] = bool(getattr(repo, "managed", True))
    if row.head_sha:
        data["headSha"] = row.head_sha
    if row.base_sha:
        data["baseSha"] = row.base_sha
    if row.analysis_version:
        data["analysisVersion"] = row.analysis_version
    if row.display_name:
        data["displayName"] = row.display_name
    if row.note:
        data["note"] = row.note
    data["favorite"] = bool(row.favorite)
    data["reviewStatus"] = row.review_status or "OPEN"
    return data
