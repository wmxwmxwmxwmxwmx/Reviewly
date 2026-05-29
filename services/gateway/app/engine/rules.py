"""Static analysis rules (mirrors services/engine rules)."""
from __future__ import annotations

import re
from typing import Any

from app.repositories.security_center import RULE_LABELS

PERF_TYPE_LABELS: dict[str, str] = {
    "blocking-io": "Blocking IO",
    "large-object-copy": "Large Object Copy",
    "duplicate-db-query": "Duplicate DB Query",
    "high-complexity-loop": "High Complexity Loop",
    "string-copy": "Unnecessary String Copy",
    "unused-move": "Unused Move",
    "n-plus-one-query": "N+1 Query",
}

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
    perf_type: str | None = None,
) -> dict[str, Any]:
    perf_label = perf_type or PERF_TYPE_LABELS.get(rule_id, rule_id)
    security_rule = RULE_LABELS.get(rule_id, rule_id)

    out: dict[str, Any] = {
        "id": rule_id,
        "ruleId": rule_id,
        "rule": security_rule if ftype == "security" else perf_label,
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
    if ftype == "performance":
        out["perfType"] = perf_label
    return out


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


def scan_blocking_io(file: str, content: str) -> list[dict[str, Any]]:
    if "sleep(" in content or "time.Sleep" in content:
        return [
            _base_finding(
                rule_id="blocking-io",
                ftype="performance",
                severity="medium",
                title="同步 sleep 可能阻塞",
                file=file,
                perf_type="Blocking IO",
                description="Diff 中出现 sleep，可能阻塞 goroutine 或线程。",
                fix_suggestion="使用 context 超时、异步 IO 或事件驱动替代忙等/sleep。",
            )
        ]
    if ("http.Get" in content or "requests.get" in content) and "await " not in content:
        return [
            _base_finding(
                rule_id="blocking-io",
                ftype="performance",
                severity="high",
                title="疑似同步 HTTP 调用",
                file=file,
                perf_type="Blocking IO",
                description="同步 HTTP 客户端可能阻塞请求路径。",
                fix_suggestion="改用异步客户端或放入后台 worker。",
            )
        ]
    return []


def scan_large_object_copy(file: str, content: str) -> list[dict[str, Any]]:
    if re.search(r"make\(\[\].*,\s*\d{4,}", content) or (
        "copy(" in content and ("[]byte" in content or "make([]" in content)
    ):
        return [
            _base_finding(
                rule_id="large-object-copy",
                ftype="performance",
                severity="medium",
                title="大对象拷贝",
                file=file,
                perf_type="Large Object Copy",
                description="检测到大缓冲区分配或 copy 操作。",
                fix_suggestion="使用指针、切片视图或流式处理减少拷贝。",
            )
        ]
    return []


def scan_duplicate_db_query(file: str, content: str) -> list[dict[str, Any]]:
    queries = len(re.findall(r"(?i)(Query|db\.Get|SELECT\s)", content))
    if queries >= 3:
        return [
            _base_finding(
                rule_id="duplicate-db-query",
                ftype="performance",
                severity="medium",
                title="重复数据库查询",
                file=file,
                perf_type="Duplicate DB Query",
                description="同一 diff 片段内出现多次查询调用。",
                fix_suggestion="合并查询、使用批量接口或缓存结果。",
            )
        ]
    return []


def scan_high_complexity_loop(file: str, content: str) -> list[dict[str, Any]]:
    for_count = content.count("for ")
    if for_count > 3 or (content.count("for ") >= 2 and "for " in content[content.find("for ") + 1 :]):
        nested = "for " in content.split("for ", 1)[-1] if "for " in content else False
        if for_count > 3 or nested:
            return [
                _base_finding(
                    rule_id="high-complexity-loop",
                    ftype="performance",
                    severity="medium",
                    title="高复杂度循环",
                    file=file,
                    perf_type="High Complexity Loop",
                    description="嵌套或多重循环可能带来 O(n²) 或更高复杂度。",
                    fix_suggestion="评估算法复杂度；考虑索引、哈希表或批处理。",
                )
            ]
    return []


def scan_string_copy(file: str, content: str) -> list[dict[str, Any]]:
    if content.count('" + ') >= 3 or content.count("' + ") >= 3:
        if "strings.Builder" not in content and "StringBuilder" not in content:
            return [
                _base_finding(
                    rule_id="string-copy",
                    ftype="performance",
                    severity="low",
                    title="不必要字符串拼接",
                    file=file,
                    perf_type="Unnecessary String Copy",
                    description="链式 + 拼接在循环中可能产生大量临时对象。",
                    fix_suggestion="使用 strings.Builder / fmt.Fprintf 或预分配 buffer。",
                )
            ]
    return []


def scan_unused_move(file: str, content: str) -> list[dict[str, Any]]:
    if "std::move" in content or ".clone()" in content:
        return [
            _base_finding(
                rule_id="unused-move",
                ftype="performance",
                severity="low",
                title="移动/克隆语义可优化",
                file=file,
                perf_type="Unused Move",
                description="检测到 move 或 clone；确认是否可避免多余拷贝。",
                fix_suggestion="优先传递引用/指针；仅在必要时 move。",
            )
        ]
    return []


def scan_n_plus_one_query(file: str, content: str) -> list[dict[str, Any]]:
    if ("for " in content or "range" in content) and re.search(
        r"(?i)(Query|Find\(|db\.|SELECT\s)", content
    ):
        return [
            _base_finding(
                rule_id="n-plus-one-query",
                ftype="performance",
                severity="high",
                title="潜在 N+1 查询",
                file=file,
                perf_type="N+1 Query",
                description="循环体内出现数据库查询模式。",
                fix_suggestion="使用 JOIN、IN 查询或 DataLoader 批量预取。",
            )
        ]
    return []


def scan_performance(file: str, content: str) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    findings.extend(scan_blocking_io(file, content))
    findings.extend(scan_large_object_copy(file, content))
    findings.extend(scan_duplicate_db_query(file, content))
    findings.extend(scan_high_complexity_loop(file, content))
    findings.extend(scan_string_copy(file, content))
    findings.extend(scan_unused_move(file, content))
    findings.extend(scan_n_plus_one_query(file, content))
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
        key = f"{f.get('file', '')}:{f.get('ruleId', f.get('id', ''))}"
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique
