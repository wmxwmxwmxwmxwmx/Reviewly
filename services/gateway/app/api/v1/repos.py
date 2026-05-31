"""Repository import and GitHub sync endpoints."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import api_error
from app.core.security import CurrentUser, get_current_user
from app.db.deps import get_db
from app.db.models import AuthUser
from app.repositories import auth_users as auth_users_repo
from app.repositories import repos as repos_repo
from app.services import repo_sync
from app.services.activity_log import record_activity

router = APIRouter(prefix="/api/repos", tags=["repos"])
logger = logging.getLogger(__name__)


class ImportRepositoryBody(BaseModel):
    url: str = Field(min_length=1)


@router.post("/import")
async def import_repository(
    body: ImportRepositoryBody,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    repository = await repo_sync.import_repository_from_url(db, body.url.strip(), user=user)
    return {"repository": repository}


@router.post("/sync")
async def sync_repositories_admin(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Legacy PAT-based sync; dev-only unless PRISM_ALLOW_LEGACY_SYNC=1."""
    if not (settings.prism_auth_bypass or settings.prism_allow_legacy_sync):
        raise api_error(
            "全局 PAT 同步仅限开发环境。请使用 POST /api/repos/sync/me 同步您的仓库。",
            403,
        )
    _ = user
    return await repo_sync.sync_github_repositories(db)


@router.post("/sync/me")
async def sync_my_repositories(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return await repo_sync.sync_repositories_for_user(db, user)


@router.delete("/{repo_id}")
async def remove_repository(
    repo_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
        full_name = repos_repo.delete_repository_for_user(db, repo_id, user.id, team_ids)
        if full_name is None:
            raise api_error("Repository not found", 404)
        record_activity(
            db,
            event_type="repo_removed",
            actor=user.username,
            action=f"Removed repository {full_name} from management",
            repo=full_name,
        )
        db.commit()
        return {"ok": True, "id": repo_id}
    except HTTPException:
        raise
    except Exception:
        logger.exception("delete repository failed repo_id=%s", repo_id)
        raise


class SyncManagedPrsBody(BaseModel):
    repo_ids: list[str] | None = Field(default=None, alias="repoIds")
    force_reconcile: bool = Field(default=False, alias="forceReconcile")

    model_config = {"populate_by_name": True}


@router.post("/sync-prs/managed")
async def sync_managed_pull_requests(
    request: Request,
    body: SyncManagedPrsBody | None = None,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    from app.services.pr_sync import sync_managed_repo_pull_requests_unified

    repo_ids = body.repo_ids if body else None
    force = body.force_reconcile if body else False
    return await sync_managed_repo_pull_requests_unified(
        db,
        user,
        repo_ids=repo_ids,
        request=request,
        force_reconcile=force,
    )


@router.post("/{repo_id}/sync-prs")
async def sync_repo_pull_requests(
    repo_id: str,
    request: Request,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
    row = repos_repo.get_repo_row_for_user(db, repo_id, user.id, team_ids)
    if row is None:
        from app.core.errors import api_error

        raise api_error("Repository not found", 404)
    from app.services.pr_sync import sync_repository_pull_requests_for_user

    return await sync_repository_pull_requests_for_user(db, row, user, request=request)
