"""Static analysis rules (mirrors services/engine rules)."""
from __future__ import annotations

import re
from typing import Any

from app.repositories.security_center import RULE_LABELS

_SECRET_PATTERNS = [
    re.compile(r"(?i)(api[_-]?key|password|secret)\s*=\s*['\"][^'\"]+['\"]"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"sk-[a-zA-Z0-9]{20,}"),
]

_TOKEN_PATTERNS = [
    re.compile(r"Bearer\s+[a-zA-Z0-9._-]{10,}"),
    re.compile(r"(?i)Authorization:\s*['\"][^'\"]+['\"]"),
]

_DANGEROUS_API = ["eval(", "exec(", "os.system", "subprocess.call", "subprocess.run"]

_CMD_INJECTION_HINTS = [
    ("os/exec", "Command"),
    ("exec.Command", "Command"),
    ("shell=True", "shell"),
]


def _base_finding(
    *,
    rule_id: str,
    ftype: str,
    severity: str,
    title: str,
    file: str,
    line: int = 0,
    description: str = "",
    cwe_id: str | None = None,
    fix_suggestion: str = "",
) -> dict[str, Any]:
    rule_label = RULE_LABELS.get(rule_id, rule_id)
    return {
        "id": rule_id,
        "ruleId": rule_id,
        "rule": rule_label,
        "type": ftype,
        "severity": severity,
        "title": title,
        "description": description or title,
        "file": file,
        "line": line,
        "confidence": 90.0 if severity == "critical" else 75.0,
        "rootCause": "",
        "fixSuggestion": fix_suggestion,
        "cweId": cwe_id,
    }


def scan_sql_concat(file: str, content: str) -> list[dict[str, Any]]:
    if "fmt.Sprintf" in content and "SELECT" in content:
        return [
            _base_finding(
                rule_id="sql-injection",
                ftype="security",
                severity="critical",
                title="疑似 SQL 拼接",
                file=file,
                cwe_id="CWE-89",
                description="fmt.Sprintf 与 SELECT 同时出现，存在 SQL 注入风险。",
                fix_suggestion="使用参数化查询（db.QueryContext）替代字符串拼接。",
            )
        ]
    return []


def scan_xss(file: str, content: str) -> list[dict[str, Any]]:
    hints = ["innerHTML", "dangerouslySetInnerHTML", "document.write"]
    if any(h in content for h in hints):
        return [
            _base_finding(
                rule_id="xss",
                ftype="security",
                severity="high",
                title="疑似 XSS 风险",
                file=file,
                cwe_id="CWE-79",
                description="检测到可能将未转义内容写入 DOM 的 API。",
                fix_suggestion="对用户输入进行编码或使用安全的 DOM API。",
            )
        ]
    return []


def scan_hardcoded_secret(file: str, content: str) -> list[dict[str, Any]]:
    for pat in _SECRET_PATTERNS:
        if pat.search(content):
            return [
                _base_finding(
                    rule_id="hardcoded-secret",
                    ftype="security",
                    severity="critical",
                    title="硬编码密钥或凭证",
                    file=file,
                    cwe_id="CWE-798",
                    description="Diff 中出现疑似明文密钥或密码赋值。",
                    fix_suggestion="将密钥移至环境变量或密钥管理服务。",
                )
            ]
    return []


def scan_token_leak(file: str, content: str) -> list[dict[str, Any]]:
    for pat in _TOKEN_PATTERNS:
        if pat.search(content):
            return [
                _base_finding(
                    rule_id="token-leak",
                    ftype="security",
                    severity="high",
                    title="Token 可能泄露",
                    file=file,
                    description="Diff 中包含 Bearer 或 Authorization 字面量。",
                    fix_suggestion="不要在源码中硬编码 token；使用安全存储与短期凭证。",
                )
            ]
    return []


def scan_dangerous_api(file: str, content: str) -> list[dict[str, Any]]:
    if any(api in content for api in _DANGEROUS_API):
        return [
            _base_finding(
                rule_id="dangerous-api",
                ftype="security",
                severity="high",
                title="危险 API 调用",
                file=file,
                description="检测到 eval/exec 或系统命令相关 API。",
                fix_suggestion="避免动态执行代码；使用白名单与沙箱。",
            )
        ]
    return []


def scan_command_injection(file: str, content: str) -> list[dict[str, Any]]:
    for hint, _label in _CMD_INJECTION_HINTS:
        if hint in content and ("+" in content or "fmt.Sprintf" in content or "%s" in content):
            return [
                _base_finding(
                    rule_id="command-injection",
                    ftype="security",
                    severity="critical",
                    title="疑似命令注入",
                    file=file,
                    cwe_id="CWE-78",
                    description="命令执行与字符串拼接同时出现。",
                    fix_suggestion="使用参数化命令接口，禁止拼接用户输入。",
                )
            ]
    return []


def scan_performance(file: str, content: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    if "for " in content and "range" in content and content.count("for ") > 3:
        findings.append(
            _base_finding(
                rule_id=f"perf-loop-{file}",
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
                rule_id=f"perf-sleep-{file}",
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
                rule_id=f"arch-imports-{file}",
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
    findings.extend(scan_xss(file, content))
    findings.extend(scan_hardcoded_secret(file, content))
    findings.extend(scan_token_leak(file, content))
    findings.extend(scan_dangerous_api(file, content))
    findings.extend(scan_command_injection(file, content))
    findings.extend(scan_performance(file, content))
    findings.extend(scan_architecture(file, content))

    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for f in findings:
        key = f.get("ruleId", f.get("id", ""))
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique
