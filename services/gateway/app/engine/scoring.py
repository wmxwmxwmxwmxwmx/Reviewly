"""Risk scoring (mirrors services/engine scoring)."""
from __future__ import annotations


def aggregate_risk_score(critical: int, high: int, medium: int) -> int:
    return min(100, critical * 25 + high * 12 + medium * 5)


def merge_recommendation(risk_score: int) -> str:
    if risk_score >= 70:
        return "block"
    if risk_score >= 40:
        return "request_changes"
    return "approve"


def scores_from_findings(findings: list[dict]) -> dict[str, int]:
    critical = sum(1 for f in findings if f.get("severity") == "critical")
    high = sum(1 for f in findings if f.get("severity") == "high")
    medium = sum(1 for f in findings if f.get("severity") == "medium")
    risk = aggregate_risk_score(critical, high, medium)

    security = [f for f in findings if f.get("type") == "security"]
    perf = [f for f in findings if f.get("type") == "performance"]
    arch = [f for f in findings if f.get("type") == "architecture"]

    def _dim_score(items: list[dict]) -> int:
        c = sum(1 for f in items if f.get("severity") == "critical")
        h = sum(1 for f in items if f.get("severity") == "high")
        m = sum(1 for f in items if f.get("severity") == "medium")
        return max(0, 100 - aggregate_risk_score(c, h, m))

    return {
        "riskScore": risk,
        "securityScore": _dim_score(security) if security else max(0, 100 - risk),
        "performanceScore": _dim_score(perf) if perf else 88,
        "maintainabilityScore": _dim_score(arch) if arch else 74,
    }
