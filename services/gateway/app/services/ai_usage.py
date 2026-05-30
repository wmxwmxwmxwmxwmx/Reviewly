"""Persist and aggregate AI token usage."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import AiUsageLog


def log_ai_usage(
    session: Session,
    *,
    user_id: str | None,
    feature: str,
    provider: str,
    model: str,
    usage: dict[str, int] | None,
    stream: bool = False,
    repository_id: str | None = None,
    pull_request_id: str | None = None,
    finding_id: str | None = None,
    job_id: str | None = None,
    latency_ms: int | None = None,
    status: str = "ok",
    error_message: str | None = None,
    cost_cny_estimate: float | None = None,
    team_id: str | None = None,
    request_id: str | None = None,
) -> None:
    prompt = int((usage or {}).get("prompt_tokens") or 0)
    completion = int((usage or {}).get("completion_tokens") or 0)
    total = int((usage or {}).get("total_tokens") or prompt + completion)
    if total <= 0 and status == "ok":
        return

    session.add(
        AiUsageLog(
            id=f"aul-{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            team_id=team_id,
            feature=feature,
            provider=provider,
            model=model,
            stream=stream,
            repository_id=repository_id,
            pull_request_id=pull_request_id,
            finding_id=finding_id,
            job_id=job_id,
            prompt_tokens=prompt,
            completion_tokens=completion,
            total_tokens=total,
            latency_ms=latency_ms,
            status=status,
            error_message=error_message,
            cost_cny_estimate=cost_cny_estimate,
            request_id=request_id,
        )
    )


def _period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "day":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _usage_filters(user_id: str | None, since: datetime):
    filters = [AiUsageLog.created_at >= since]
    if user_id:
        filters.append(AiUsageLog.user_id == user_id)
    return filters


def get_usage_summary(
    session: Session,
    *,
    user_id: str | None,
    period: str = "month",
) -> dict[str, Any]:
    since = _period_start(period if period in ("day", "month") else "month")
    filters = _usage_filters(user_id, since)

    total_tokens = int(
        session.scalar(
            select(func.coalesce(func.sum(AiUsageLog.total_tokens), 0)).where(*filters)
        )
        or 0
    )
    calls = int(session.scalar(select(func.count()).where(*filters)) or 0)
    cost_cny = float(
        session.scalar(
            select(func.coalesce(func.sum(AiUsageLog.cost_cny_estimate), 0)).where(*filters)
        )
        or 0
    )

    by_feature_rows = session.execute(
        select(AiUsageLog.feature, func.sum(AiUsageLog.total_tokens), func.count())
        .where(*filters)
        .group_by(AiUsageLog.feature)
    ).all()
    by_feature = [
        {"feature": row[0], "totalTokens": int(row[1] or 0), "calls": int(row[2] or 0)}
        for row in by_feature_rows
    ]

    by_model_rows = session.execute(
        select(AiUsageLog.model, func.sum(AiUsageLog.total_tokens), func.count())
        .where(*filters)
        .group_by(AiUsageLog.model)
    ).all()
    by_model = [
        {"model": row[0], "totalTokens": int(row[1] or 0), "calls": int(row[2] or 0)}
        for row in by_model_rows
    ]

    return {
        "period": period,
        "totalTokens": total_tokens,
        "calls": calls,
        "costCny": round(cost_cny, 4),
        "byFeature": by_feature,
        "byModel": by_model,
    }
