"""Review center API — dashboard, stats, comments, timeline, approval."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import get_optional_user
from app.core.errors import SCHEMA_OUTDATED_MESSAGE, api_error
from app.db.deps import get_db
from app.db.models import AuthUser
from app.repositories import pull_requests as pr_repo
from app.repositories import review_center as rc_repo

router = APIRouter(prefix="/api/review-center", tags=["review-center"])


def _resolve_user_scope(db: Session, user: AuthUser | None) -> tuple[str | None, list[str]]:
    from app.api.v1.data import _resolve_user_scope as resolve

    return resolve(db, user)


def _ensure_review_schema() -> None:
    from app.main import migration_status

    if migration_status == "failed":
        raise api_error(SCHEMA_OUTDATED_MESSAGE, 503, code="SCHEMA_OUTDATED")


class ReviewCommentBody(BaseModel):
    comment_type: str = Field(alias="type")
    content: str = Field(default="", min_length=0)

    model_config = {"populate_by_name": True}


class ReviewStatusBody(BaseModel):
    review_status: str = Field(alias="reviewStatus")

    model_config = {"populate_by_name": True}


@router.get("/dashboard")
def review_dashboard(
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    _ensure_review_schema()
    user_id, team_ids = _resolve_user_scope(db, user)
    username = user.username if user else None
    return rc_repo.get_dashboard(
        db, user_id=user_id, team_ids=team_ids, username=username
    )


@router.get("/stats")
def review_stats(
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    _ensure_review_schema()
    user_id, team_ids = _resolve_user_scope(db, user)
    return rc_repo.get_stats(db, user_id=user_id, team_ids=team_ids)


@router.get("/status-counts")
def review_status_counts(
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
    repo_id: str | None = Query(None, alias="repoId"),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    return rc_repo.count_by_review_status(
        db, repo_id=repo_id, user_id=user_id, team_ids=team_ids
    )


@router.get("/repo-groups")
def review_repo_groups(
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    return {"groups": rc_repo.list_repo_groups(db, user_id=user_id, team_ids=team_ids)}


@router.get("/pull-requests/{pr_id}/comments")
def list_pr_review_comments(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    items = rc_repo.list_review_comments(db, pr_id, user_id=user_id, team_ids=team_ids)
    if items is None:
        raise api_error("合并请求不存在", 404)
    return {"items": items}


@router.post("/pull-requests/{pr_id}/comments")
def post_pr_review_comment(
    pr_id: str,
    body: ReviewCommentBody,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    if body.comment_type == "APPROVE":
        blocked = rc_repo.check_approval_blocked(db, pr_id)
        if blocked.get("blocked"):
            raise api_error(
                "当前 PR 存在严重风险，请修复后重新提交",
                403,
                code="APPROVAL_BLOCKED",
            )
    saved = rc_repo.add_review_comment(
        db,
        pr_id,
        comment_type=body.comment_type,
        content=body.content,
        user=user,
        user_id=user_id,
        team_ids=team_ids,
    )
    if saved is None:
        raise api_error("无法提交审批意见", 400)
    return saved


@router.get("/pull-requests/{pr_id}/timeline")
def get_pr_timeline(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    items = rc_repo.list_timeline(db, pr_id, user_id=user_id, team_ids=team_ids)
    if items is None:
        raise api_error("合并请求不存在", 404)
    return {"items": items}


@router.get("/pull-requests/{pr_id}/approval-check")
def get_approval_check(
    pr_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    if pr_repo.get_pull_request(db, pr_id, user_id=user_id, team_ids=team_ids) is None:
        raise api_error("合并请求不存在", 404)
    return rc_repo.check_approval_blocked(db, pr_id)


@router.patch("/pull-requests/{pr_id}/review-status")
def patch_review_status(
    pr_id: str,
    body: ReviewStatusBody,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
) -> dict:
    user_id, team_ids = _resolve_user_scope(db, user)
    updated = rc_repo.update_review_status(
        db,
        pr_id,
        body.review_status,
        user=user,
        user_id=user_id,
        team_ids=team_ids,
    )
    if updated is None:
        raise api_error("合并请求不存在或状态无效", 404)
    return updated
