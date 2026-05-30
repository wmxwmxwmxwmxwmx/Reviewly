"""On-demand weekly dashboard summary via LLM."""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.anthropic import call_anthropic
from app.ai.openai_compatible import call_openai_compatible
from app.ai.providers import get_endpoint
from app.db.models import AnalysisFinding, AnalysisJob
from app.repositories.analysis import _finding_to_api
from app.repositories.dashboard import get_dashboard
from app.repositories import settings as settings_repo
from app.repositories.seed_filter import exclude_seed_findings, is_seed_repository
from app.repositories import auth_users as auth_users_repo
from app.services.ai_config import resolve_ai_config
from app.services.ai_usage import log_ai_usage


async def generate_weekly_summary(
    session: Session,
    *,
    api_key_override: str | None = None,
) -> dict[str, Any]:
    cfg = settings_repo.get_settings(session)
    ai = cfg.get("ai", {})
    provider, model, api_key, custom_endpoint = resolve_ai_config(
        session,
        api_key_override=api_key_override,
    )

    since = datetime.now(timezone.utc) - timedelta(days=7)
    from app.db.models import PullRequest, Repository

    findings_stmt = exclude_seed_findings(
        select(AnalysisFinding)
        .join(AnalysisJob, AnalysisFinding.job_id == AnalysisJob.id)
        .join(PullRequest, AnalysisJob.pull_request_id == PullRequest.id)
        .join(Repository, PullRequest.repository_id == Repository.id)
    )
    findings_rows = session.scalars(findings_stmt).all()
    recent_findings = []
    for row in findings_rows:
        job = session.get(AnalysisJob, row.job_id)
        if job and job.completed_at and job.completed_at.replace(tzinfo=timezone.utc) >= since:
            recent_findings.append(_finding_to_api(row))

    dash = get_dashboard(session)
    reviews = dash.get("recentReviews", [])[:10]

    prompt = (
        "你是 PRism 代码审查平台的助手。根据以下最近 7 天的 findings 与 PR 分析摘要，"
        "用中文 Markdown 输出三段：\n"
        "1. 高频风险\n2. 团队 Review 建议\n3. 风险趋势总结\n\n"
        f"Findings ({len(recent_findings)}):\n"
        f"{_compact_findings(recent_findings[:20])}\n\n"
        f"Recent reviews ({len(reviews)}):\n"
        f"{reviews}\n"
    )
    messages = [{"role": "user", "content": prompt}]
    temperature = float(ai.get("temperature", 0.2))
    started = time.time()

    if provider == "anthropic":
        result = await call_anthropic(
            model=model,
            api_key=api_key.strip(),
            messages=messages,
            temperature=temperature,
        )
    else:
        endpoint = get_endpoint(provider, custom_endpoint)
        result = await call_openai_compatible(
            endpoint=endpoint or "",
            provider=provider,
            model=model,
            api_key=api_key.strip(),
            messages=messages,
            temperature=temperature,
        )

    content = result["content"]
    weekly = settings_repo.save_dashboard_weekly_summary(
        session,
        content=content,
        model=model,
        provider=provider,
    )
    latency_ms = int((time.time() - started) * 1000)
    user = auth_users_repo.get_or_create_bypass_user(session)
    log_ai_usage(
        session,
        user_id=user.id,
        feature="dashboard_summary",
        provider=provider,
        model=model,
        usage=result.get("usage"),
        latency_ms=latency_ms,
    )
    session.commit()
    return {
        "content": content,
        "usage": result.get("usage"),
        "latencyMs": latency_ms,
        "weeklySummary": weekly,
    }


def _compact_findings(findings: list[dict]) -> str:
    lines = []
    for f in findings:
        lines.append(
            f"- [{f.get('severity')}] {f.get('type')}: {f.get('title')} ({f.get('file')}:{f.get('line')})"
        )
    return "\n".join(lines) if lines else "(无)"
