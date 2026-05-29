"""On-demand streaming architecture analysis via LLM."""
from __future__ import annotations

import json
from typing import Any, AsyncIterator

from sqlalchemy.orm import Session

from app.ai.anthropic import stream_anthropic
from app.ai.openai_compatible import stream_openai_compatible
from app.ai.providers import get_endpoint
from app.core.errors import api_error
from app.repositories import architecture as architecture_repo
from app.services.ai_config import resolve_ai_config

SYSTEM_PROMPT = """你是资深软件架构师。根据依赖图与模块指标，用中文 Markdown 输出五节（使用二级标题）：
## 架构风险
## 高耦合模块
## 重构建议
## 分层问题
## 模块职责
基于给定数据，不要编造未出现的文件路径。"""


def _compact_graph(graph: dict) -> dict[str, Any]:
    nodes = graph.get("nodes", [])[:80]
    edges = graph.get("edges", [])[:120]
    metrics = graph.get("metrics", {})
    return {"nodes": nodes, "edges": edges, "metrics": metrics}


async def stream_architecture_analysis(
    session: Session, repo_id: str
) -> AsyncIterator[str]:
    graph = architecture_repo.get_dependency_graph(session, repo_id)
    provider, model, api_key, custom_endpoint = resolve_ai_config(session)
    payload = _compact_graph(graph)
    user_msg = (
        f"仓库 ID: {repo_id}\n\n"
        f"依赖图与指标 JSON:\n{json.dumps(payload, ensure_ascii=False, indent=2)[:12000]}"
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]
    temperature = 0.2

    if provider == "anthropic":
        async for delta in stream_anthropic(
            model=model, api_key=api_key, messages=messages, temperature=temperature
        ):
            yield delta
    else:
        endpoint = get_endpoint(provider, custom_endpoint)
        async for delta in stream_openai_compatible(
            endpoint=endpoint or "",
            provider=provider,
            model=model,
            api_key=api_key,
            messages=messages,
            temperature=temperature,
        ):
            yield delta
