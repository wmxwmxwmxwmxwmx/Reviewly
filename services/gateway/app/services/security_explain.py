"""On-demand AI explanation for security findings."""
from __future__ import annotations

import json
from typing import Any, AsyncIterator

from sqlalchemy.orm import Session

from app.ai.anthropic import stream_anthropic
from app.ai.openai_compatible import stream_openai_compatible
from app.ai.providers import get_endpoint
from app.core.errors import api_error
from app.repositories import security as security_repo
from app.services.ai_config import resolve_ai_config

SYSTEM_PROMPT = """你是资深应用安全工程师。根据提供的 PR Diff finding 与代码上下文，用 Markdown 输出四节（使用二级标题）：
## 风险原理
## 攻击方式
## 修复建议
## 影响分析
简洁、可执行，面向研发读者。不要编造未在上下文中出现的文件路径。"""


def _build_user_message(ctx: dict[str, Any]) -> str:
    finding = ctx.get("finding") or ctx
    parts = [
        f"规则: {ctx.get('rule', '')}",
        f"严重度: {ctx.get('severity', '')}",
        f"仓库: {ctx.get('repo', '')} PR #{ctx.get('prNumber', '')}",
        f"文件: {ctx.get('file', '')}:{ctx.get('line', '')}",
        f"描述: {ctx.get('description', '')}",
        f"已有建议: {ctx.get('suggestion', '')}",
        f"\nFinding JSON:\n{json.dumps(finding, ensure_ascii=False, indent=2)}",
    ]
    if ctx.get("codeContext"):
        parts.append(f"\n代码上下文:\n```\n{ctx['codeContext']}\n```")
    if ctx.get("patchExcerpt"):
        parts.append(f"\nPatch 摘要:\n```diff\n{ctx['patchExcerpt'][:2000]}\n```")
    return "\n".join(parts)


async def stream_finding_explanation(
    session: Session,
    finding_id: str,
) -> AsyncIterator[str]:
    ctx = security_repo.get_finding_with_context(session, finding_id)
    if not ctx:
        raise api_error("安全发现不存在", 404)

    provider, model, api_key, _ = resolve_ai_config(session)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_message(ctx)},
    ]

    if provider == "anthropic":
        async for delta in stream_anthropic(
            model=model,
            api_key=api_key,
            messages=messages,
            temperature=0.2,
        ):
            yield delta
    else:
        endpoint = get_endpoint(provider, None)
        async for delta in stream_openai_compatible(
            endpoint=endpoint or "",
            provider=provider,
            model=model,
            api_key=api_key,
            messages=messages,
            temperature=0.2,
        ):
            yield delta
