"""Unified findings center API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.db.deps import get_db
from app.repositories import findings_center

router = APIRouter(prefix="/api/findings", tags=["findings"])


class PatchFindingBody(BaseModel):
    status: str = Field(min_length=1)


@router.get("")
def list_findings(
    type: str | None = Query(None, description="security | performance | architecture | maintainability | convention"),
    severity: str | None = None,
    repo: str | None = None,
    repo_id: str | None = Query(None, alias="repoId"),
    status: str | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    sort: str = Query("createdAt"),
    db: Session = Depends(get_db),
) -> dict:
    if type and type not in findings_center.CATEGORY_TYPES:
        raise api_error(
            "type 必须为 security、performance、architecture、maintainability 或 convention",
            400,
        )

    items, total = findings_center.list_findings_filtered(
        db,
        finding_type=type,
        severity=severity,
        repo=repo,
        repo_id=repo_id,
        status=status,
        q=q,
        page=page,
        page_size=page_size,
        sort=sort,
    )
    stats = findings_center.compute_stats(db, finding_type=type, repo=repo, repo_id=repo_id)
    category_stats = findings_center.compute_category_stats(db, repo=repo, repo_id=repo_id)
    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "stats": stats,
        "categoryStats": category_stats,
    }


@router.patch("/{finding_id}")
def patch_finding(
    finding_id: str,
    body: PatchFindingBody,
    db: Session = Depends(get_db),
) -> dict:
    row = findings_center.patch_finding_status(db, finding_id, status=body.status)
    if not row:
        raise api_error("风险项不存在或状态无效", 404)
    return row


@router.get("/{finding_id}")
def get_finding(finding_id: str, db: Session = Depends(get_db)) -> dict:
    row = findings_center.get_finding(db, finding_id)
    if not row:
        raise api_error("风险项不存在", 404)
    return row
