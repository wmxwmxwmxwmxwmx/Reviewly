"""On-demand weekly dashboard summary via LLM."""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.anthropic import call_anthropic
from app.ai.openai_compatible import call_openai_compatible
from app.ai.providers import VALID_PROVIDERS, get_endpoint
from app.core.errors import api_error
from app.db.models import AnalysisFinding, AnalysisJob
from app.repositories import settings as settings_repo
from app.repositories.analysis import _finding_to_api
from app.repositories.dashboard import get_dashboard


async def generate_weekly_summary(
    session: Session,
    *,
    api_key_override: str | None = None,
) -> dict[str, Any]:
    cfg = settings_repo.get_settings(session)
    ai = cfg.get("ai", {})
    provider = str(ai.get("provider", "openai"))
    model = str(ai.get("model", "")).strip()
    secrets = settings_repo.get_decrypted_secrets(session)
    api_key = (
        secrets.get(provider)
        or secrets.get("apiKey", "")
        or (api_key_override or "").strip()
    )
    custom_endpoint = ai.get("customEndpoint")

    if provider not in VALID_PROVIDERS:
        raise api_error("请在系统设置中选择有效的模型供应商", 400)
    if not model:
        raise api_error("请先在系统设置中填写模型名称", 400)
    if not api_key.strip():
        raise api_error("请先在系统设置中配置 API Key", 400)

    since = datetime.now(timezone.utc) - timedelta(days=7)
    findings_rows = session.scalars(select(AnalysisFinding)).all()
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
    session.commit()
    return {
        "content": content,
        "usage": result.get("usage"),
        "latencyMs": int((time.time() - started) * 1000),
        "weeklySummary": weekly,
    }


def _compact_findings(findings: list[dict]) -> str:
    lines = []
    for f in findings:
        lines.append(
            f"- [{f.get('severity')}] {f.get('type')}: {f.get('title')} ({f.get('file')}:{f.get('line')})"
        )
    return "\n".join(lines) if lines else "(无)"
