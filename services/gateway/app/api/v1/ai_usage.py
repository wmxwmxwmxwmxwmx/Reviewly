"""AI usage summary API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.deps import get_db
from app.db.models import AuthUser
from app.services.ai_usage import get_usage_summary

router = APIRouter(prefix="/api/ai/usage", tags=["ai-usage"])


@router.get("/summary")
def usage_summary(
    period: str = Query("month", pattern="^(month|day)$"),
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return get_usage_summary(db, user_id=user.id, period=period)
