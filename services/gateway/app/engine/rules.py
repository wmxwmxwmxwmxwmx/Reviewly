"""Static analysis rules (mirrors services/engine rules)."""
from __future__ import annotations

from typing import Any


def _base_finding(
    *,
    fid: str,
    ftype: str,
    severity: str,
    title: str,
    file: str,
    line: int = 0,
    description: str = "",
    cwe_id: str | None = None,
) -> dict[str, Any]:
    return {
        "id": fid,
        "type": ftype,
        "severity": severity,
        "title": title,
        "description": description or title,
        "file": file,
        "line": line,
        "confidence": 90.0 if severity == "critical" else 75.0,
        "rootCause": "",
        "fixSuggestion": "",
        "cweId": cwe_id,
    }


def scan_sql_concat(file: str, content: str) -> list[dict[str, Any]]:
    if "fmt.Sprintf" in content and "SELECT" in content:
        return [
            _base_finding(
                fid="rule-sql",
                ftype="security",
                severity="critical",
                title="疑似 SQL 拼接",
                file=file,
                cwe_id="CWE-89",
                description="fmt.Sprintf 与 SELECT 同时出现，存在 SQL 注入风险。",
            )
        ]
    return []


def scan_performance(file: str, content: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    if "for " in content and "range" in content and content.count("for ") > 3:
        findings.append(
            _base_finding(
                fid=f"perf-loop-{file}",
                ftype="performance",
                severity="medium",
                title="嵌套循环可能影响性能",
                file=file,
                description="检测到多处循环，建议评估时间复杂度。",
            )
        )
    if "sleep(" in content or "time.Sleep" in content:
        findings.append(
            _base_finding(
                fid=f"perf-sleep-{file}",
                ftype="performance",
                severity="low",
                title="同步 sleep 可能阻塞",
                file=file,
            )
        )
    return findings


def scan_architecture(file: str, content: str) -> list[dict[str, Any]]:
    if "import " in content and content.count("import ") > 15:
        return [
            _base_finding(
                fid=f"arch-imports-{file}",
                ftype="architecture",
                severity="medium",
                title="文件依赖过多",
                file=file,
                description="import 数量较多，建议拆分模块。",
            )
        ]
    return []


def scan_file(file: str, content: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    findings.extend(scan_sql_concat(file, content))
    findings.extend(scan_performance(file, content))
    findings.extend(scan_architecture(file, content))
    return findings
