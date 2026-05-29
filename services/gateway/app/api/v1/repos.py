"""Repository import and GitHub sync endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db.deps import get_db
from app.db.models import AuthUser
from app.repositories import auth_users as auth_users_repo
from app.repositories import repos as repos_repo
from app.services import repo_sync

router = APIRouter(prefix="/api/repos", tags=["repos"])


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
async def sync_repositories_admin(db: Session = Depends(get_db)) -> dict:
    """Legacy PAT-based sync (no user context)."""
    return await repo_sync.sync_github_repositories(db)


@router.post("/sync/me")
async def sync_my_repositories(
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return await repo_sync.sync_repositories_for_user(db, user)


@router.post("/{repo_id}/sync-prs")
async def sync_repo_pull_requests(
    repo_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    team_ids = auth_users_repo.get_team_ids_for_user(db, user.id)
    row = repos_repo.get_repo_row_for_user(db, repo_id, user.id, team_ids)
    if row is None:
        from app.core.errors import api_error

        raise api_error("Repository not found", 404)
    from app.services.pr_sync import sync_repository_pull_requests_for_user

    return await sync_repository_pull_requests_for_user(db, row, user)
