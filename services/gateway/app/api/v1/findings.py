"""Unified findings center API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.db.deps import get_db
from app.repositories import findings_center

router = APIRouter(prefix="/api/findings", tags=["findings"])


@router.get("")
def list_findings(
    type: str | None = Query(None, description="security | performance"),
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
    if type and type not in findings_center.FINDING_TYPES:
        raise api_error("type 必须为 security 或 performance", 400)

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
    filter_kwargs = {
        "finding_type": type,
        "severity": severity,
        "repo": repo,
        "repo_id": repo_id,
        "status": status,
        "q": q,
    }
    stats = findings_center.compute_stats(db, **filter_kwargs)
    return {
        "items": items,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "stats": stats,
        "trends": {
            "last7Days": findings_center.compute_trends(db, **filter_kwargs, days=7),
            "last30Days": findings_center.compute_trends(db, **filter_kwargs, days=30),
        },
    }


@router.get("/{finding_id}")
def get_finding(finding_id: str, db: Session = Depends(get_db)) -> dict:
    row = findings_center.get_finding(db, finding_id)
    if not row:
        raise api_error("风险项不存在", 404)
    return row
