import type { DiffChunk, DiffFile, DiffLine, PRData, RiskItem } from "@reviewly/shared"

export type { DiffChunk, DiffFile, DiffLine, PRData, RiskItem }

export const mockPRData: PRData = {
  url: "https://github.com/acme-corp/backend/pull/2847",
  repo: "backend/payment-service",
  number: 2847,
  sourceBranch: "feature/refactor-cache",
  targetBranch: "main",
  title: "refactor: 重构支付网关缓存层，引入 Redis Cluster 分片策略与熔断机制",
  author: "chen.wei",
  authorAvatar: "CW",
  createdAt: "2025-05-28T14:23:00Z",
  labels: [
    { name: "performance", color: "oklch(0.62 0.19 240)" },
    { name: "breaking-change", color: "oklch(0.55 0.22 27)" },
    { name: "payment", color: "oklch(0.65 0.18 46)" },
  ],
  filesChanged: 47,
  additions: 3241,
  deletions: 1872,
  commits: 18,
  riskScore: 78,
  riskLevel: "high",
  securityScore: 62,
  performanceScore: 88,
  maintainabilityScore: 74,
  deploymentRisk: "high",
  rollbackComplexity: "high",
}

export const mockRisks: RiskItem[] = [
  {
    id: "r1",
    severity: "critical",
    type: "Race Condition",
    title: "缓存更新存在竞态条件",
    description: "在高并发场景下，多个 goroutine 同时执行 CAS 操作可能导致支付状态不一致，引发重复扣款风险。",
    file: "internal/cache/payment_cache.go",
    line: 142,
    cweId: "CWE-362",
    confidence: 96,
    rootCause: "CacheManager.UpdatePaymentStatus() 未使用分布式锁，乐观锁 version 字段在集群模式下失效",
    exploitability: "high",
    fixSuggestion: "使用 Redis SET NX EX 实现分布式锁，或改用 Lua 脚本保证原子性",
    callChain: ["PaymentController.Process()", "PaymentService.Execute()", "CacheManager.UpdatePaymentStatus()"],
  },
  {
    id: "r2",
    severity: "critical",
    type: "SQL Injection",
    title: "动态查询存在 SQL 注入风险",
    description: "buildDynamicQuery() 直接拼接用户输入参数到 SQL 语句，未经过参数化处理。",
    file: "internal/db/query_builder.go",
    line: 89,
    cweId: "CWE-89",
    confidence: 98,
    rootCause: "fmt.Sprintf 直接格式化 userInput 参数，绕过了 database/sql 的参数绑定机制",
    exploitability: "high",
    fixSuggestion: "使用 db.QueryContext 的参数化查询，禁止字符串拼接构建 SQL",
    callChain: ["API.SearchTransactions()", "QueryBuilder.buildDynamicQuery()"],
  },
  {
    id: "r3",
    severity: "high",
    type: "Memory Leak",
    title: "HTTP 连接池资源未释放",
    description: "GatewayClient 在超时重试场景下未关闭旧连接，连接数随时间线性增长。",
    file: "internal/gateway/client.go",
    line: 234,
    cweId: "CWE-401",
    confidence: 89,
    rootCause: "http.Client 在重试时创建新连接但未调用 resp.Body.Close()",
    exploitability: "medium",
    fixSuggestion: "使用 defer resp.Body.Close() 确保连接释放，配置连接池 MaxIdleConnsPerHost",
  },
  {
    id: "r4",
    severity: "high",
    type: "JWT Issue",
    title: "JWT 签名算法可被降级",
    description: "validateToken() 未固定签名算法，攻击者可构造 alg:none 的 JWT 绕过验证。",
    file: "internal/auth/jwt.go",
    line: 67,
    cweId: "CWE-347",
    confidence: 94,
    rootCause: "jwt.Parse 未指定 KeyFunc 的 expected algorithms 参数",
    exploitability: "high",
    fixSuggestion: "使用 jwt.ParseWithClaims 并明确指定 jwt.SigningMethodHS256，拒绝 none 算法",
  },
  {
    id: "r5",
    severity: "medium",
    type: "API Breaking",
    title: "支付回调接口返回结构变更",
    description: "PaymentCallback 响应移除了 legacy_txn_id 字段，可能导致调用方解析失败。",
    file: "api/v2/payment/callback.go",
    line: 45,
    confidence: 82,
    rootCause: "struct 字段删除未经过弃用周期，直接影响 downstream 系统",
    exploitability: "low",
    fixSuggestion: "保留 legacy_txn_id 字段并标记 deprecated，在下一个大版本中移除",
  },
  {
    id: "r6",
    severity: "medium",
    type: "Deadlock",
    title: "Redis 分布式锁可能死锁",
    description: "acquireLock() 在网络抖动时未设置超时，可能永久阻塞事务协程。",
    file: "internal/lock/redis_lock.go",
    line: 78,
    cweId: "CWE-833",
    confidence: 85,
    rootCause: "BLPOP 命令未设置 timeout 参数，等同于无限阻塞",
    exploitability: "medium",
    fixSuggestion: "设置锁获取超时 ctx.WithTimeout(5s)，失败后触发熔断而非重试",
  },
]

export const mockDiffFiles: DiffFile[] = [
  {
    path: "internal/cache/payment_cache.go",
    type: "modified",
    additions: 142,
    deletions: 89,
    riskLevel: "critical",
    language: "go",
    owner: "platform-infra",
    collapsed: false,
    chunks: [
      {
        header: "@@ -135,18 +142,31 @@ func (c *CacheManager) UpdatePaymentStatus(",
        lines: [
          { type: "context", oldNum: 135, newNum: 142, content: "func (c *CacheManager) UpdatePaymentStatus(ctx context.Context, txnID string, status PaymentStatus) error {" },
          { type: "context", oldNum: 136, newNum: 143, content: "\tc.mu.RLock()" },
          { type: "delete", oldNum: 137, content: "\tdefer c.mu.RUnlock()" },
          { type: "delete", oldNum: 138, content: "\tcurrent, err := c.client.Get(ctx, txnID).Result()" },
          { type: "delete", oldNum: 139, content: "\tif err != nil { return err }" },
          { type: "add", newNum: 144, content: "\t// TODO: 实现乐观锁重试机制" },
          { type: "add", newNum: 145, content: "\tcurrent, version, err := c.getWithVersion(ctx, txnID)", riskComment: { severity: "critical", message: "getWithVersion 在集群模式下 version 字段跨节点不一致，存在 ABA 问题，建议改用 Lua 脚本原子操作" } },
          { type: "add", newNum: 146, content: "\tif err != nil { return fmt.Errorf(\"cache get: %w\", err) }" },
          { type: "add", newNum: 147, content: "\tif current.Status == status { return nil }" },
          { type: "add", newNum: 148, content: "\tnewVal := &PaymentCacheEntry{Status: status, Version: version + 1}" },
          { type: "add", newNum: 149, content: "\treturn c.client.Set(ctx, txnID, newVal, ttl).Err()" },
          { type: "context", oldNum: 140, newNum: 150, content: "}" },
        ],
      },
    ],
  },
  {
    path: "internal/db/query_builder.go",
    type: "modified",
    additions: 34,
    deletions: 21,
    riskLevel: "critical",
    language: "go",
    owner: "data-platform",
    collapsed: false,
    chunks: [
      {
        header: "@@ -82,14 +89,18 @@ func buildDynamicQuery(",
        lines: [
          { type: "context", oldNum: 82, newNum: 89, content: "func buildDynamicQuery(table string, filters map[string]interface{}) string {" },
          { type: "delete", oldNum: 83, content: "\tquery := fmt.Sprintf(\"SELECT * FROM %s WHERE \", table)" },
          { type: "delete", oldNum: 84, content: "\tfor k, v := range filters {" },
          { type: "delete", oldNum: 85, content: "\t\tquery += fmt.Sprintf(\"%s = '%v' AND \", k, v)", riskComment: { severity: "critical", message: "直接字符串拼接用户输入，存在高危 SQL 注入漏洞（CWE-89），CVSS 9.8 严重" } },
          { type: "delete", oldNum: 86, content: "\t}" },
          { type: "add", newNum: 90, content: "\tvar args []interface{}" },
          { type: "add", newNum: 91, content: "\tvar conditions []string" },
          { type: "add", newNum: 92, content: "\tfor k, v := range filters {" },
          { type: "add", newNum: 93, content: "\t\tconditions = append(conditions, fmt.Sprintf(\"%s = $%d\", k, len(args)+1))" },
          { type: "add", newNum: 94, content: "\t\targs = append(args, v)" },
          { type: "add", newNum: 95, content: "\t}" },
          { type: "context", oldNum: 87, newNum: 96, content: "\treturn query, args" },
          { type: "context", oldNum: 88, newNum: 97, content: "}" },
        ],
      },
    ],
  },
  {
    path: "internal/gateway/client.go",
    type: "modified",
    additions: 89,
    deletions: 34,
    riskLevel: "high",
    language: "go",
    owner: "gateway-team",
    collapsed: false,
    chunks: [
      {
        header: "@@ -228,12 +234,24 @@ func (c *GatewayClient) callWithRetry(",
        lines: [
          { type: "context", oldNum: 228, newNum: 234, content: "func (c *GatewayClient) callWithRetry(ctx context.Context, req *http.Request) (*http.Response, error) {" },
          { type: "context", oldNum: 229, newNum: 235, content: "\tfor attempt := 0; attempt < c.maxRetries; attempt++ {" },
          { type: "context", oldNum: 230, newNum: 236, content: "\t\tresp, err := c.httpClient.Do(req)" },
          { type: "delete", oldNum: 231, content: "\t\tif err != nil { continue }" },
          { type: "add", newNum: 237, content: "\t\tif err != nil {", riskComment: { severity: "high", message: "resp.Body 未调用 Close()，重试场景下连接池泄漏，高负载下 TIME_WAIT 连接将耗尽端口资源" } },
          { type: "add", newNum: 238, content: "\t\t\ttime.Sleep(backoff(attempt))" },
          { type: "add", newNum: 239, content: "\t\t\tcontinue" },
          { type: "add", newNum: 240, content: "\t\t}" },
          { type: "add", newNum: 241, content: "\t\tif resp.StatusCode >= 500 {" },
          { type: "add", newNum: 242, content: "\t\t\t// resp.Body not closed here - memory leak" },
          { type: "add", newNum: 243, content: "\t\t\tcontinue" },
          { type: "add", newNum: 244, content: "\t\t}" },
          { type: "context", oldNum: 232, newNum: 245, content: "\t\treturn resp, nil" },
          { type: "context", oldNum: 233, newNum: 246, content: "\t}" },
          { type: "context", oldNum: 234, newNum: 247, content: "\treturn nil, ErrMaxRetriesExceeded" },
        ],
      },
    ],
  },
  {
    path: "api/v2/payment/callback.go",
    type: "modified",
    additions: 23,
    deletions: 45,
    riskLevel: "medium",
    language: "go",
    owner: "payment-team",
    collapsed: true,
    chunks: [
      {
        header: "@@ -18,12 +18,25 @@ func HandlePaymentCallback(w http.ResponseWriter, r *http.Request) {",
        lines: [
          { type: "context", oldNum: 18, newNum: 18, content: "\t\treturn" },
          { type: "delete", oldNum: 19, newNum: 19, content: "\t\tw.WriteHeader(http.StatusOK)" },
          { type: "add", newNum: 19, content: "\t\tif !rateLimiter.Allow(r.RemoteAddr) {" },
          { type: "add", newNum: 20, content: "\t\t\tw.WriteHeader(http.StatusTooManyRequests)" },
          { type: "add", newNum: 21, content: "\t\t\treturn" },
          { type: "add", newNum: 22, content: "\t\t}" },
          { type: "add", newNum: 23, content: "\t\tw.WriteHeader(http.StatusOK)" },
        ],
      },
    ],
  },
  {
    path: "internal/auth/jwt.go",
    type: "modified",
    additions: 12,
    deletions: 8,
    riskLevel: "high",
    language: "go",
    owner: "security-team",
    collapsed: true,
    chunks: [
      {
        header: "@@ -45,8 +45,14 @@ func ValidateToken(token string) (*Claims, error) {",
        lines: [
          { type: "context", oldNum: 45, newNum: 45, content: "\tclaims, err := parseClaims(token)" },
          { type: "delete", oldNum: 46, newNum: 46, content: "\tif claims.Exp < time.Now().Unix() {" },
          { type: "add", newNum: 46, content: "\tif claims.Exp < time.Now().Add(-clockSkew).Unix() {" },
          { type: "add", newNum: 47, content: "\t\treturn nil, ErrTokenExpired" },
          { type: "context", oldNum: 47, newNum: 48, content: "\t}" },
          { type: "add", newNum: 49, content: "\tif claims.Iss != expectedIssuer {" },
          { type: "add", newNum: 50, content: "\t\treturn nil, ErrInvalidIssuer" },
          { type: "add", newNum: 51, content: "\t}" },
        ],
      },
    ],
  },
  {
    path: "configs/redis_cluster.yaml",
    type: "modified",
    additions: 34,
    deletions: 12,
    riskLevel: "low",
    language: "yaml",
    owner: "infra",
    collapsed: true,
    chunks: [
      {
        header: "@@ -1,8 +1,22 @@ cluster:",
        lines: [
          { type: "context", oldNum: 1, newNum: 1, content: "cluster:" },
          { type: "delete", oldNum: 2, newNum: 2, content: "  nodes: 1" },
          { type: "add", newNum: 2, content: "  nodes: 6" },
          { type: "add", newNum: 3, content: "  shards: 3" },
          { type: "add", newNum: 4, content: "  replicas: 1" },
          { type: "add", newNum: 5, content: "  hash_slot_policy: crc16" },
          { type: "context", oldNum: 3, newNum: 6, content: "  timeout: 500ms" },
        ],
      },
    ],
  },
  {
    path: "internal/metrics/payment_metrics.go",
    type: "added",
    additions: 178,
    deletions: 0,
    riskLevel: "none",
    language: "go",
    owner: "observability",
    collapsed: true,
    chunks: [
      {
        header: "@@ -0,0 +1,12 @@ package metrics",
        lines: [
          { type: "add", newNum: 1, content: "package metrics" },
          { type: "add", newNum: 2, content: "" },
          { type: "add", newNum: 3, content: "import \"github.com/prometheus/client_golang/prometheus\"" },
          { type: "add", newNum: 4, content: "" },
          { type: "add", newNum: 5, content: "var PaymentCacheHitRatio = prometheus.NewGaugeVec(" },
          { type: "add", newNum: 6, content: "\tprometheus.GaugeOpts{" },
          { type: "add", newNum: 7, content: "\t\tName: \"payment_cache_hit_ratio\"," },
          { type: "add", newNum: 8, content: "\t\tHelp: \"Cache hit ratio for payment lookups\"," },
          { type: "add", newNum: 9, content: "\t}," },
          { type: "add", newNum: 10, content: "\t[]string{\"shard\"}," },
          { type: "add", newNum: 11, content: ")" },
        ],
      },
    ],
  },
]

export const mockGovernanceRules = [
  { id: "g1", rule: "禁止在支付逻辑中打印 Token / 密钥", violated: true, file: "internal/payment/processor.go:312", severity: "critical" },
  { id: "g2", rule: "禁止使用同步 RPC 调用跨服务", violated: true, file: "internal/gateway/client.go:156", severity: "high" },
  { id: "g3", rule: "禁止直接访问主库写节点", violated: false, file: null, severity: "critical" },
  { id: "g4", rule: "所有外部接口必须有 Rate Limiter", violated: true, file: "api/v2/payment/callback.go:23", severity: "high" },
  { id: "g5", rule: "禁止跨层调用 (Controller → Repository)", violated: false, file: null, severity: "high" },
  { id: "g6", rule: "数据库迁移必须有回滚脚本", violated: false, file: null, severity: "medium" },
]

export const mockIncidents = [
  {
    id: "i1",
    title: "P0: 支付网关缓存穿透导致数据库雪崩",
    date: "2025-03-12",
    similarity: 94,
    impact: "影响 23 万用户，GMV 损失 ¥180 万",
    postmortemUrl: "#",
  },
  {
    id: "i2",
    title: "P1: Redis Cluster 分片迁移期间双写不一致",
    date: "2025-01-08",
    similarity: 81,
    impact: "部分订单状态错误，持续 47 分钟",
    postmortemUrl: "#",
  },
  {
    id: "i3",
    title: "P2: HTTP 连接池耗尽引发支付超时",
    date: "2024-11-20",
    similarity: 76,
    impact: "支付成功率下降至 82%，持续 12 分钟",
    postmortemUrl: "#",
  },
]

export const mockAISummary = `## 变更摘要

本 PR 对支付服务的缓存层进行了大规模重构，引入 **Redis Cluster 分片策略**，旨在将缓存吞吐量从 ~50K QPS 提升至 200K+ QPS。

## 核心变更

**缓存架构**：从单节点 Redis 迁移至 6 节点集群（3主3从），新增一致性哈希分片逻辑，同时引入本地 L1 缓存（sync.Map）作为 Hot Key 缓解方案。

**熔断机制**：集成 hystrix-go，为 GatewayClient 添加三态熔断器（关闭/开启/半开），设置失败率阈值 50%、窗口期 10s。

**监控指标**：新增 Prometheus 指标 \`payment_cache_hit_ratio\`、\`payment_lock_contention_total\` 等 12 个关键指标。

## 重大风险

> ⚠️ **架构变更存在 3 处严重级别问题**，建议合并前完整修复。

- 缓存更新逻辑存在**竞态条件**，高并发下可能导致重复扣款
- 遗留 SQL 拼接代码存在**注入漏洞**（CVSS 9.8），攻击面覆盖交易查询接口
- HTTP 连接资源泄漏将在压测场景下引发端口耗尽

## 破坏性变更

\`PaymentCallback\` 响应体移除 \`legacy_txn_id\` 字段，下游 billing-service、reconcile-service 需同步更新。`
