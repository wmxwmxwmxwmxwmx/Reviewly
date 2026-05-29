"""Build analysis summary from findings."""
from __future__ import annotations

from typing import Any

from app.engine.scoring import merge_recommendation, scores_from_findings


def build_result_summary(findings: list[dict[str, Any]], pull_request_id: str) -> dict[str, Any]:
    scores = scores_from_findings(findings)
    rec = merge_recommendation(scores["riskScore"])

    critical = [f for f in findings if f.get("severity") == "critical"]
    high = [f for f in findings if f.get("severity") == "high"]

    lines = [
        "## 变更摘要",
        "",
        f"已完成对 PR `{pull_request_id}` 的自动分析（规则引擎）。",
        "",
        "## 发现概览",
        "",
        f"- 严重: {len(critical)}",
        f"- 高: {len(high)}",
        f"- 总计: {len(findings)}",
        "",
    ]
    if critical:
        lines.append("## 重大风险")
        lines.append("")
        for f in critical[:3]:
            lines.append(f"- **{f.get('title')}** (`{f.get('file')}`)")
        lines.append("")

    return {
        "summary": "\n".join(lines),
        "mergeRecommendation": rec,
        **scores,
    }
