"""Repository import and GitHub sync endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.services import repo_sync

router = APIRouter(prefix="/api/repos", tags=["repos"])


class ImportRepositoryBody(BaseModel):
    url: str = Field(min_length=1)


@router.post("/import")
async def import_repository(
    body: ImportRepositoryBody,
    db: Session = Depends(get_db),
) -> dict:
    repository = await repo_sync.import_repository_from_url(db, body.url.strip())
    return {"repository": repository}


@router.post("/sync")
async def sync_repositories(db: Session = Depends(get_db)) -> dict:
    return await repo_sync.sync_github_repositories(db)
