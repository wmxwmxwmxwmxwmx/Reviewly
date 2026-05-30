"""Generate and persist repository AI summary (onboarding step)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories import repos as repos_repo
from app.services.repo_analyze_context import build_repo_analyze_context


async def generate_repo_ai_summary(session: Session, repo_id: str) -> dict | None:
    ctx = await build_repo_analyze_context(session, repo_id)
    if not ctx:
        return None
    repo = ctx.get("repository") or {}
    findings = ctx.get("recentFindings") or []
    readme = (ctx.get("readme") or "")[:4000]
    tree = (ctx.get("fileTree") or "")[:3000]
    summary_lines = [
        f"## 仓库概览：{repo.get('fullName', repo_id)}",
        "",
        f"- 语言：{repo.get('language') or '未知'}",
        f"- 开放 PR：{repo.get('openPrCount', 0)}",
        f"- 健康度：{repo.get('healthScore', 0)}%",
        "",
        "### 最近发现",
        "",
    ]
    if findings:
        for f in findings[:10]:
            summary_lines.append(
                f"- [{f.get('severity', '?')}] {f.get('title', '')} ({f.get('file', '')}:{f.get('line', 0)})"
            )
    else:
        summary_lines.append("- 暂无结构化 findings")
    summary_lines.extend(
        ["", "### README 摘要", "", readme or "（无 README）", "", "### 目录结构（节选）", "", tree or "（无）"]
    )
    content = "\n".join(summary_lines)
    return repos_repo.save_repo_ai_analysis(
        session, repo_id, content=content, model="onboarding", provider="system"
    )
