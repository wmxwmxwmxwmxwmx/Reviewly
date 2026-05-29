"""B0 mock data — mirrors apps/web mock-data.ts (camelCase JSON)."""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

_SEED_JSON = Path(__file__).parent / "seed_data.json"

DEFAULT_PR_ID = "pr-2847"


def is_demo_pr(pr_id: str) -> bool:
    return pr_id == DEFAULT_PR_ID

_REPOS: list[dict[str, Any]] = [
    {
        "id": "repo-payment",
        "fullName": "acme-corp/backend",
        "name": "backend",
        "owner": "acme-corp",
        "defaultBranch": "main",
        "openPrCount": 12,
        "healthScore": 78,
        "lastSyncTime": "2025-05-28T10:00:00Z",
        "aiReviewEnabled": True,
    },
    {
        "id": "repo-auth",
        "fullName": "acme-corp/auth-service",
        "name": "auth-service",
        "owner": "acme-corp",
        "defaultBranch": "main",
        "openPrCount": 4,
        "healthScore": 88,
        "lastSyncTime": "2025-05-27T09:00:00Z",
        "aiReviewEnabled": True,
    },
]

_PULL_REQUESTS: list[dict[str, Any]] = [
    {
        "id": DEFAULT_PR_ID,
        "repoId": "repo-payment",
        "repo": "backend/payment-service",
        "number": 2847,
        "title": "refactor: 重构支付网关缓存层，引入 Redis Cluster 分片策略与熔断机制",
        "author": "chen.wei",
        "state": "open",
        "riskLevel": "high",
        "riskScore": 78,
        "updatedAt": "2025-05-28T14:23:00Z",
        "sourceBranch": "feature/refactor-cache",
        "targetBranch": "main",
        "authorAvatar": "CW",
        "createdAt": "2025-05-28T14:23:00Z",
        "labels": [
            {"name": "performance", "color": "oklch(0.62 0.19 240)"},
            {"name": "breaking-change", "color": "oklch(0.55 0.22 27)"},
            {"name": "payment", "color": "oklch(0.65 0.18 46)"},
        ],
        "filesChanged": 47,
        "additions": 3241,
        "deletions": 1872,
        "commits": 18,
        "securityScore": 62,
        "performanceScore": 88,
        "maintainabilityScore": 74,
        "deploymentRisk": "high",
        "rollbackComplexity": "high",
        "url": "https://github.com/acme-corp/backend/pull/2847",
    },
    {
        "id": "pr-1838",
        "repoId": "repo-auth",
        "repo": "auth-service",
        "number": 1838,
        "title": "feat: OAuth2 token refresh 优化",
        "author": "li.ming",
        "state": "open",
        "riskLevel": "medium",
        "riskScore": 45,
        "updatedAt": "2025-05-27T09:00:00Z",
        "sourceBranch": "feat/oauth-refresh",
        "targetBranch": "main",
        "authorAvatar": "LM",
        "createdAt": "2025-05-26T12:00:00Z",
        "labels": [],
        "filesChanged": 8,
        "additions": 320,
        "deletions": 45,
        "commits": 4,
        "securityScore": 85,
        "performanceScore": 72,
        "maintainabilityScore": 80,
        "deploymentRisk": "low",
        "rollbackComplexity": "low",
        "url": "https://github.com/acme-corp/auth-service/pull/1838",
    },
]

_MOCK_RISKS: list[dict[str, Any]] = [
    {
        "id": "r1",
        "ruleId": "r1",
        "rule": "Race Condition",
        "severity": "critical",
        "type": "security",
        "title": "缓存更新存在竞态条件",
        "description": "在高并发场景下，多个 goroutine 同时执行 CAS 操作可能导致支付状态不一致，引发重复扣款风险。",
        "file": "internal/cache/payment_cache.go",
        "line": 142,
        "cweId": "CWE-362",
        "confidence": 96,
        "rootCause": "CacheManager.UpdatePaymentStatus() 未使用分布式锁",
        "exploitability": "high",
        "fixSuggestion": "使用 Redis SET NX EX 实现分布式锁，或改用 Lua 脚本保证原子性",
        "callChain": [
            "PaymentController.Process()",
            "PaymentService.Execute()",
            "CacheManager.UpdatePaymentStatus()",
        ],
    },
    {
        "id": "r2",
        "ruleId": "sql-injection",
        "rule": "SQL Injection",
        "severity": "critical",
        "type": "security",
        "title": "动态查询存在 SQL 注入风险",
        "description": "buildDynamicQuery() 直接拼接用户输入参数到 SQL 语句，未经过参数化处理。",
        "file": "internal/db/query_builder.go",
        "line": 89,
        "cweId": "CWE-89",
        "confidence": 98,
        "rootCause": "fmt.Sprintf 直接格式化 userInput 参数",
        "exploitability": "high",
        "fixSuggestion": "使用 db.QueryContext 的参数化查询",
        "callChain": ["API.SearchTransactions()", "QueryBuilder.buildDynamicQuery()"],
    },
    {
        "id": "r3",
        "ruleId": "r3",
        "rule": "Resource Leak",
        "severity": "high",
        "type": "security",
        "title": "HTTP 连接池资源未释放",
        "description": "GatewayClient 在超时重试场景下未关闭旧连接。",
        "file": "internal/gateway/client.go",
        "line": 234,
        "cweId": "CWE-401",
        "confidence": 89,
        "rootCause": "http.Client 在重试时创建新连接但未调用 resp.Body.Close()",
        "exploitability": "medium",
        "fixSuggestion": "使用 defer resp.Body.Close()",
    },
]

_MOCK_AI_SUMMARY = """## 变更摘要

本 PR 对支付服务的缓存层进行了大规模重构，引入 **Redis Cluster 分片策略**。

## 重大风险

- 缓存更新逻辑存在**竞态条件**
- 遗留 SQL 拼接代码存在**注入漏洞**
"""

_DEFAULT_SETTINGS: dict[str, Any] = {
    "ai": {"provider": "openai", "model": "gpt-4o-mini", "temperature": 0.2},
    "analysis": {"autoRunOnOpen": False, "maxChunks": 32},
    "notifications": {"emailEnabled": False},
}

_settings_store: dict[str, Any] = deepcopy(_DEFAULT_SETTINGS)


def _load_diff_files() -> list[dict[str, Any]]:
    if _SEED_JSON.is_file():
        data = json.loads(_SEED_JSON.read_text(encoding="utf-8"))
        if "mockDiffFiles" in data:
            return data["mockDiffFiles"]
    # Minimal fallback diff
    return [
        {
            "path": "internal/cache/payment_cache.go",
            "type": "modified",
            "additions": 142,
            "deletions": 89,
            "riskLevel": "critical",
            "language": "go",
            "owner": "platform-infra",
            "collapsed": False,
            "chunks": [
                {
                    "header": "@@ -135,18 +142,31 @@",
                    "lines": [
                        {
                            "type": "add",
                            "newNum": 145,
                            "content": "\tcurrent, version, err := c.getWithVersion(ctx, txnID)",
                            "riskComment": {
                                "severity": "critical",
                                "message": "version 字段跨节点不一致，建议改用 Lua 脚本",
                            },
                        },
                    ],
                }
            ],
        }
    ]


def get_dashboard() -> dict[str, Any]:
    return {
        "pendingPrs": 12,
        "securityIssues": 5,
        "qualityScore": 87,
        "avgReviewHours": 2.4,
        "recentActivity": [
            {
                "type": "pr-merged",
                "user": "张维",
                "action": "合并了 PR #1838",
                "repo": "prism-core",
                "time": "10 分钟前",
            },
        ],
        "topRepos": [
            {"name": "prism-core", "prs": 8, "issues": 3, "health": 92},
            {"name": "api-gateway", "prs": 6, "issues": 5, "health": 72},
        ],
    }


def list_repos() -> list[dict[str, Any]]:
    return deepcopy(_REPOS)


def list_pull_requests(
    *,
    repo: str | None = None,
    risk: str | None = None,
    author: str | None = None,
    state: str | None = None,
) -> list[dict[str, Any]]:
    items = deepcopy(_PULL_REQUESTS)
    if repo:
        items = [p for p in items if repo in p.get("repo", "")]
    if risk:
        items = [p for p in items if p.get("riskLevel") == risk]
    if author:
        items = [p for p in items if author.lower() in p.get("author", "").lower()]
    if state:
        items = [p for p in items if p.get("state") == state]
    return items


def get_pull_request(pr_id: str) -> dict[str, Any] | None:
    for pr in _PULL_REQUESTS:
        if pr["id"] == pr_id:
            return deepcopy(pr)
    return None


def get_diff(pr_id: str) -> list[dict[str, Any]]:
    if pr_id != DEFAULT_PR_ID and get_pull_request(pr_id) is None:
        return []
    return deepcopy(_load_diff_files())


def list_security_findings() -> list[dict[str, Any]]:
    return deepcopy(_MOCK_RISKS)


def list_findings(pr_id: str) -> list[dict[str, Any]]:
    if get_pull_request(pr_id) is None:
        return []
    return deepcopy(_MOCK_RISKS)


def get_latest_analysis(pr_id: str) -> dict[str, Any] | None:
    if get_pull_request(pr_id) is None:
        return None
    pr = get_pull_request(pr_id) or {}
    return {
        "summary": _MOCK_AI_SUMMARY,
        "mergeRecommendation": "request_changes",
        "riskScore": pr.get("riskScore", 0),
        "securityScore": pr.get("securityScore", 0),
        "performanceScore": pr.get("performanceScore", 0),
        "maintainabilityScore": pr.get("maintainabilityScore", 0),
    }


def get_settings() -> dict[str, Any]:
    return deepcopy(_settings_store)


def patch_settings(patch: dict[str, Any]) -> dict[str, Any]:
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(_settings_store.get(key), dict):
            _settings_store[key].update(value)
        else:
            _settings_store[key] = value
    return get_settings()


def get_governance_rules() -> list[dict[str, Any]]:
    return [
        {
            "id": "g1",
            "rule": "禁止在支付逻辑中打印 Token / 密钥",
            "violated": True,
            "file": "internal/payment/processor.go:312",
            "severity": "critical",
        },
    ]


def get_team_members() -> list[dict[str, Any]]:
    return [
        {
            "id": "u1",
            "name": "陈薇",
            "role": "Tech Lead",
            "reviewsThisWeek": 14,
            "avgReviewTimeHours": 1.8,
            "riskFindings": 3,
        },
    ]
