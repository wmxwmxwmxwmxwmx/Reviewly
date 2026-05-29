# PRism 功能实现计划

本文档基于当前 PRism 前端界面整理实现计划，按优先级从 MVP 到完整工程质量平台逐步推进。

## 目标

将当前静态前端演示升级为可用的 AI Pull Request 智能评审平台，支持仓库接入、PR 同步、diff 展示、AI 分析、安全/性能/架构风险识别、治理规则和团队质量分析。

---

## P0：前端 API 化与导航基础

目标：先让现有前端从静态 mock 组件变成真实 client-server 架构，为后续数据库、GitHub、AI 分析替换数据源打基础。

### 1. 建立共享类型层

新增：

- `lib/types/prism.ts`

迁移并统一定义：

- `Repository`
- `PullRequest`
- `PullRequestFile`
- `DiffFile`
- `DiffChunk`
- `DiffLine`
- `AnalysisJob`
- `AnalysisFinding`
- `SecurityFinding`
- `PerformanceFinding`
- `ArchitectureFinding`
- `GovernanceRule`
- `TeamMember`
- `PrismSettings`

现有 `components/prism/mock-data.ts` 中的 interface 应迁移到 `lib/types/prism.ts`，mock 文件只保留开发数据。

### 2. 建立 API client

新增：

- `lib/api/client.ts`
- `lib/api/dashboard.ts`
- `lib/api/repos.ts`
- `lib/api/pull-requests.ts`
- `lib/api/analysis.ts`
- `lib/api/security.ts`
- `lib/api/performance.ts`
- `lib/api/architecture.ts`
- `lib/api/governance.ts`
- `lib/api/team.ts`
- `lib/api/settings.ts`

统一处理：

- `fetch` 封装
- JSON 解析
- 错误格式
- abort signal
- API response 类型

### 3. 建立数据 hooks

新增：

- `hooks/use-dashboard.ts`
- `hooks/use-repos.ts`
- `hooks/use-pull-requests.ts`
- `hooks/use-pull-request.ts`
- `hooks/use-pull-request-diff.ts`
- `hooks/use-analysis-job.ts`
- `hooks/use-security-findings.ts`
- `hooks/use-settings.ts`

第一版可以使用 `useEffect + useState`，后续建议替换为 TanStack Query。

### 4. 建立 mock API routes

第一阶段先不接数据库、不接 GitHub、不接 AI，API 直接返回当前 mock 数据。

新增：

- `app/api/dashboard/route.ts`
- `app/api/repos/route.ts`
- `app/api/pull-requests/route.ts`
- `app/api/pull-requests/[id]/route.ts`
- `app/api/pull-requests/[id]/diff/route.ts`
- `app/api/pull-requests/[id]/analysis/latest/route.ts`
- `app/api/security/findings/route.ts`
- `app/api/settings/route.ts`

### 5. URL 驱动导航

当前 `app/page.tsx` 使用本地 state 控制 view，刷新会丢失页面状态。应改成 URL query 驱动。

目标 URL：

- `/?view=dashboard`
- `/?view=pull-requests`
- `/?view=ai-review&prId=2847`
- `/?view=security&severity=critical`
- `/?view=architecture&prId=2847`

改造文件：

- `app/page.tsx`
- `components/prism/navigation-context.tsx`
- `components/prism/sidebar.tsx`

新增能力：

- `navigate(view, params?)`
- 从 `searchParams` 读取当前 view
- 支持浏览器刷新后恢复当前页面
- 支持 PR / finding / diff 行级跳转

### 6. 去 mock 化优先级

按以下顺序改造页面数据来源：

1. `AIReviewView`
2. `PRListView`
3. `DashboardView`
4. `SecurityView`
5. `ReposView`
6. `PerformanceView`
7. `ArchitectureView`
8. `GovernanceView`
9. `TeamView`
10. `SettingsView`

### P0 验收标准

- 页面视觉基本保持不变。
- Network 面板能看到 API 请求。
- 刷新页面不丢当前 view。
- `AIReviewView` 不再直接依赖固定 `mockPRData`。
- `PRListView` 点击 PR 能进入 `?view=ai-review&prId=xxx`。
- mock API 可替换为数据库实现而不改 UI 组件结构。

---

## P1：PR 评审核心闭环

目标：完成“选 PR -> 看详情 -> 看 diff -> 点击分析 -> 显示进度 -> 展示结果”的最小可用闭环。

### 1. Pull Request 列表模块

实现功能：

- PR 列表加载
- 按仓库筛选
- 按风险等级筛选
- 按作者筛选
- 按状态筛选
- 按更新时间 / 风险分排序
- 点击 PR 进入 AI 评审详情页

前端接入：

- `PRListView` 调用 `usePullRequests(filters)`
- 点击 PR 调用 `navigate("ai-review", { prId })`

后端 API：

- `GET /api/pull-requests`
- `GET /api/pull-requests/:id`
- `POST /api/pull-requests/:id/sync`

### 2. AI Review 页面真实联动

当前 `AIReviewView` 需要从 URL 获取 `prId`，并加载真实 PR 数据。

实现功能：

- 加载 PR 基础信息
- 加载 PR diff 文件
- 加载最新 AI summary
- 加载 findings
- 处理 loading / error / empty 状态

前端接入：

- `usePullRequest(prId)`
- `usePullRequestDiff(prId)`
- `useLatestAnalysis(prId)`

涉及组件：

- `Header`
- `PROverview`
- `AISummary`
- `DiffViewer`
- `AIPanel`

### 3. Analysis Job 模拟真实化

替换当前本地随机进度。

实现流程：

1. 点击“开始分析”。
2. 前端调用 `POST /api/pull-requests/:id/analysis`。
3. 后端返回 `jobId`。
4. 前端每 1 秒轮询 `GET /api/analysis/jobs/:jobId`。
5. UI 显示真实 job 状态：`pending | running | completed | failed`。
6. job 完成后刷新 PR summary、findings 和 diff comments。

后端 API：

- `POST /api/pull-requests/:id/analysis`
- `GET /api/analysis/jobs/:jobId`
- `GET /api/pull-requests/:id/analysis/latest`
- `GET /api/pull-requests/:id/findings`

### 4. DiffViewer 行级风险定位

实现功能：

- 文件折叠 / 展开
- 根据 URL 参数定位文件和行号
- 风险行高亮
- 行级 AI comment 展示
- 从 Security / Architecture 页面跳转到具体 diff 行

目标 URL：

- `/?view=ai-review&prId=2847&file=internal/db/query_builder.go&line=89`

### 5. AI Summary 和 AI Panel

实现功能：

- 总体风险等级
- Merge 建议：可合并 / 需修改 / 阻止合并
- 关键风险列表
- 修复建议
- 模型信息
- token 使用量
- chunk 处理进度
- 生成 review comment 草稿

### P1 验收标准

- 从 PR 列表点击任意 PR 能进入对应详情。
- 分析按钮不再使用本地随机进度。
- 刷新 `?view=ai-review&prId=xxx` 可恢复详情页。
- 分析完成后 summary、findings、diff comment 会更新。
- 从风险列表能跳转并定位到具体 diff 行。

---

## P2：数据库持久化

目标：让仓库、PR、diff、分析任务和分析结果可持久化。

### 1. 数据库技术选型

推荐：PostgreSQL + Prisma 或 Drizzle。

优先建议 Prisma，便于快速建模、迁移和 seed mock 数据。

### 2. 核心数据表

优先建立：

- `users`
- `teams`
- `repositories`
- `pull_requests`
- `pull_request_files`
- `diff_chunks`
- `analysis_jobs`
- `analysis_findings`
- `review_comments`
- `settings`

后续再扩展：

- `security_findings`
- `performance_findings`
- `architecture_findings`
- `governance_rules`
- `governance_violations`
- `audit_logs`

### 3. Seed 当前 mock 数据

把当前 `mock-data.ts` 中的：

- PR 数据
- diff 数据
- risk 数据
- dashboard 数据

写入 seed 脚本，确保数据库版本上线后 UI 仍有可展示数据。

### 4. API routes 改查数据库

逐步替换 P0 的 mock API：

1. `GET /api/pull-requests`
2. `GET /api/pull-requests/:id`
3. `GET /api/pull-requests/:id/diff`
4. `GET /api/pull-requests/:id/analysis/latest`
5. `GET /api/security/findings`
6. `GET /api/dashboard`

### P2 验收标准

- 重启服务后数据不丢。
- PR、diff、analysis result 从 DB 返回。
- mock 数据只用于 seed 或开发 fallback。
- 设置页改动可以保存。

---

## P3：仓库管理与 GitHub 集成

目标：平台能接入真实 GitHub 仓库，自动同步 PR 和 diff。

### 1. 仓库管理模块

实现功能：

- GitHub App 连接
- 仓库列表
- 仓库同步
- 仓库启用 / 停用 AI 评审
- 仓库扫描规则配置
- 忽略路径配置
- 风险阈值配置

前端页面：

- `ReposView`

前端 hooks：

- `useRepos()`
- `useSyncRepo(repoId)`
- `useUpdateRepoSettings(repoId)`

后端 API：

- `GET /api/repos`
- `POST /api/repos/sync`
- `PATCH /api/repos/:id/settings`
- `GET /api/integrations/github/install-url`
- `GET /api/integrations/github/callback`

### 2. GitHub App 接入

实现流程：

1. 用户在仓库管理页点击“连接 GitHub”。
2. 后端生成 GitHub App install URL。
3. 用户安装 App。
4. GitHub callback 返回 installation。
5. 后端保存 installation id。
6. 后端同步仓库列表。
7. 前端刷新仓库和 PR 数据。

### 3. PR 同步

同步内容：

- PR metadata
- commits
- changed files
- diff patch
- labels
- reviewers
- checks
- merge status

### 4. Webhook

处理事件：

- `pull_request.opened`
- `pull_request.synchronize`
- `pull_request.closed`
- `pull_request_review.submitted`
- `check_suite.completed`

后端 API：

- `POST /api/webhooks/github`

### P3 验收标准

- 能连接 GitHub。
- 能看到真实仓库。
- 能看到真实 open PR。
- 新 PR 创建后平台自动出现。
- PR 更新后 diff 和 analysis 状态能刷新。

---

## P4：AI 分析引擎真实化

目标：用真实 AI 模型分析真实 PR diff，输出结构化 findings、summary 和治理建议。

### 1. 分析 pipeline

建议结构：

- `lib/analysis/pipeline.ts`
- `lib/analysis/chunking.ts`
- `lib/analysis/scoring.ts`
- `lib/analysis/governance.ts`
- `lib/analysis/prompts/security.ts`
- `lib/analysis/prompts/performance.ts`
- `lib/analysis/prompts/architecture.ts`
- `lib/analysis/prompts/summary.ts`

流程：

1. 读取 PR diff。
2. normalize files。
3. split chunks。
4. classify file type。
5. 执行 security analysis。
6. 执行 performance analysis。
7. 执行 architecture analysis。
8. 执行 maintainability review。
9. 聚合 findings。
10. 生成 summary。
11. 执行 governance rules。
12. 保存结果。

### 2. Chunking

实现要求：

- 按文件和 hunk 切分。
- 保留上下文行。
- 大文件分片。
- 忽略 lockfile、dist、generated 文件。
- 保留文件路径、语言、owner、行号映射。

### 3. 结构化输出

AI 输出必须 schema validation，避免前端收到不可用格式。

Finding 字段：

- `id`
- `type`
- `severity`
- `title`
- `description`
- `file`
- `line`
- `confidence`
- `rootCause`
- `impact`
- `fixSuggestion`
- `cweId`
- `category`

### 4. Scoring

聚合评分：

- `riskScore`
- `securityScore`
- `performanceScore`
- `maintainabilityScore`
- `deploymentRisk`
- `rollbackComplexity`
- `mergeRecommendation`

### 5. Token 与成本记录

记录：

- provider
- model
- prompt tokens
- completion tokens
- total cost
- duration
- cache hit rate

展示位置：

- `AIPanel`
- 分析历史详情

### 6. 失败处理

实现：

- job retry
- per chunk error
- partial result
- timeout
- rate limit
- 前端错误提示

### P4 验收标准

- 对真实 diff 生成结构化 findings。
- finding 能映射到文件和行。
- summary 能说明是否建议合并。
- AI Panel 能展示模型、token、耗时。
- 分析失败时有清晰错误状态和重试按钮。

---

## P5：安全中心

目标：把 AI 分析出的安全风险沉淀成安全工作台。

### 1. 安全风险列表

实现功能：

- Critical / High / Medium / Low 筛选
- CWE / CVE / OWASP 分类
- 文件、行号、PR、仓库、作者展示
- 置信度展示
- 修复状态展示

前端：

- `SecurityView`
- `useSecurityFindings(filters)`
- `useSecurityStats()`

后端 API：

- `GET /api/security/findings`
- `GET /api/security/findings/:id`
- `PATCH /api/security/findings/:id/status`

### 2. 安全详情

展示：

- 根因解释
- 攻击路径
- 影响范围
- 修复建议
- 关联 diff 行

交互：

- 点击 finding 跳转 `AIReviewView` 并定位到 diff 行。
- 支持忽略风险，但必须填写理由。

后端 API：

- `POST /api/security/findings/:id/ignore`

### 3. 安全趋势

展示：

- 每周新增漏洞
- 平均修复时长
- 高频漏洞类型
- 高风险仓库排行

后端 API：

- `GET /api/security/stats`

### P5 验收标准

- 安全中心展示真实 findings。
- 能按严重等级和仓库筛选。
- 能跳转到具体 PR diff 行。
- 忽略风险会写入审计记录。

---

## P6：性能分析

目标：识别 PR 对性能的潜在影响。

### 1. 性能风险类型

实现分析：

- 热路径变更
- 查询复杂度变化
- 循环 / IO / 网络调用风险
- bundle size 变化
- 数据库索引风险
- 缓存命中率风险

### 2. 性能页面

前端：

- `PerformanceView`
- `usePerformanceStats()`
- `usePerformanceFindings(filters)`

后端 API：

- `GET /api/performance/stats`
- `GET /api/performance/findings`
- `GET /api/performance/findings/:id`

### 3. PR 详情联动

`PROverview` 使用真实：

- `performanceScore`
- `deploymentRisk`
- `rollbackComplexity`

### P6 验收标准

- 性能页面能展示真实性能 findings。
- PR 详情能显示性能分。
- 高风险性能问题能跳转到 diff 行。

---

## P7：架构分析

目标：识别 PR 的模块边界、依赖和系统影响范围。

### 1. 影响范围分析

实现：

- 当前 PR 修改哪些模块
- 影响哪些 API
- 影响哪些 downstream
- 是否跨边界调用
- 是否引入循环依赖

### 2. 依赖图

展示：

- service -> module -> file
- PR 变更节点高亮
- 高风险依赖路径标红

前端：

- `ArchitectureView`
- `useArchitectureOverview(repoId)`
- `useArchitectureImpact(prId)`
- `useDependencyGraph(repoId | prId)`

后端 API：

- `GET /api/architecture/repos/:repoId/graph`
- `GET /api/architecture/pull-requests/:prId/impact`
- `GET /api/architecture/findings`
- `POST /api/architecture/analyze`

### 3. 架构规则

支持规则：

- 禁止 controller 直接访问 db
- 禁止跨 bounded context 访问内部包
- 禁止循环依赖
- 禁止未授权模块访问 payment/auth 等敏感域

### P7 验收标准

- 架构页展示 PR 影响范围。
- 能发现基础架构违规。
- 能从架构 finding 跳转到 PR diff。

---

## P8：工程治理

目标：把分析结果转换为可执行的质量门禁。

### 1. 规则管理

实现规则：

- 大 PR 阈值
- 必须测试覆盖
- 必须 owner review
- 风险等级阻断规则
- breaking change 流程
- secret scanning 规则

前端：

- `GovernanceView`
- `useGovernanceRules()`
- `useGovernanceViolations(filters)`
- `useUpdateGovernanceRule()`

后端 API：

- `GET /api/governance/rules`
- `POST /api/governance/rules`
- `PATCH /api/governance/rules/:id`
- `GET /api/governance/violations`

### 2. Merge Gate

根据规则生成：

- `passed`
- `warning`
- `blocked`

并返回到 PR detail，用于 `Header` 和 `PROverview` 展示。

### 3. Override 与审计

实现：

- override 必须填写理由
- 记录操作人
- 记录时间
- 记录规则和 PR

后端 API：

- `POST /api/governance/violations/:id/override`
- `GET /api/audit-logs`

### P8 验收标准

- Critical 风险可阻止合并建议。
- 规则命中有记录。
- override 必须填写理由。
- 审计日志可查询。

---

## P9：团队分析

目标：让平台支持团队级质量和评审效率分析。

### 1. 团队成员

实现：

- GitHub 用户映射到平台用户
- 角色管理
- 团队归属
- 负责仓库 / code owners

前端：

- `TeamView`
- `useTeamMembers()`
- `useUpdateMemberRole()`

后端 API：

- `GET /api/team/members`
- `PATCH /api/team/members/:id`

### 2. 评审效率

指标：

- 平均响应时间
- 平均完成时间
- 每人 review 数
- 高风险 PR 处理情况

API：

- `GET /api/team/stats/reviews`

### 3. 质量贡献

指标：

- 谁引入风险较多
- 谁修复风险较多
- 哪些团队模块风险最高

API：

- `GET /api/team/stats/risks`

### P9 验收标准

- 团队页能看到真实成员和角色。
- 能查看评审效率指标。
- 能按团队过滤 PR 和风险。

---

## P10：系统设置与集成

目标：让管理员能配置 AI、集成、通知和分析规则。

### 1. AI 模型配置

实现：

- provider
- model name
- API key
- token budget
- temperature
- 是否启用缓存

注意：

- API key 不允许完整回显。
- 前端只显示脱敏值，例如 `sk-****abcd`。
- 密钥不得保存到 localStorage。

### 2. 分析配置

实现：

- 最大 diff 大小
- 单文件最大行数
- 忽略路径
- security / performance / architecture / maintainability 开关

### 3. 通知配置

实现：

- Slack / 飞书通知
- 高危 PR 通知对象
- 分析失败通知
- 每日摘要

### 4. 设置 API

前端：

- `SettingsView`
- `useSettings()`
- `useUpdateSettings()`
- `testIntegration(type)`

后端 API：

- `GET /api/settings`
- `PATCH /api/settings`
- `POST /api/settings/test-integration`
- `POST /api/settings/rotate-secret`

### P10 验收标准

- 设置可保存。
- API key 脱敏显示。
- 集成可测试连接。
- 分析配置能影响后续 analysis job。

---

## 推荐实施顺序摘要

1. P0：前端 API 化与 URL 导航。
2. P1：PR 评审核心闭环。
3. P2：数据库持久化。
4. P3：仓库管理与 GitHub 集成。
5. P4：AI 分析引擎真实化。
6. P5：安全中心。
7. P6：性能分析。
8. P7：架构分析。
9. P8：工程治理。
10. P9：团队分析。
11. P10：系统设置与集成。

最小 MVP 应优先完成 P0 + P1。这样即使后端仍然使用 mock 数据，产品体验也已经形成真实工作流，后续可以逐步把数据源替换为数据库、GitHub 和真实 AI 分析。
