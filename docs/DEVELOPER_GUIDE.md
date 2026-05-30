# PRism 开发者指南

本文档面向新加入的开发者，帮助你在 **Reviewly / PRism** Monorepo 中快速理解架构、跑通环境、定位代码与扩展功能。

> 产品路线图与里程碑见 [plan.md](./plan.md)。根目录 [README.md](../README.md) 提供精简的快速开始。

---

## 目录

1. [项目是什么](#1-项目是什么)
2. [系统架构](#2-系统架构)
3. [仓库目录结构](#3-仓库目录结构)
4. [环境要求与快速启动](#4-环境要求与快速启动)
5. [配置说明](#5-配置说明)
6. [数据与持久化](#6-数据与持久化)
7. [仓库与 PR 如何进入系统](#7-仓库与-pr-如何进入系统)
8. [前端开发指南](#8-前端开发指南)
9. [后端开发指南](#9-后端开发指南)
10. [C++ 分析引擎](#10-c-分析引擎)
11. [REST API 一览](#11-rest-api-一览)
12. [AI 能力与持久化](#12-ai-能力与持久化)
13. [测试与质量检查](#13-测试与质量检查)
14. [常见开发任务](#14-常见开发任务)
15. [故障排查](#15-故障排查)
16. [代码规范与相关文档](#16-代码规范与相关文档)

---

## 1. 项目是什么

**PRism** 是企业级 AI Pull Request 智能评审平台，采用暗色 DevTools 风格 UI，覆盖：

| 模块 | 路径（侧边栏） | 主要职责 |
|------|----------------|----------|
| 总览面板 | `dashboard` | 质量指标、活动流、周报摘要（可 AI 生成） |
| 合并请求 | `pull-requests` | PR 列表、筛选、跳转 AI 评审 |
| AI 评审 | `ai-review` | Diff 展示、发起分析、查看 findings |
| 安全中心 | `security` | 安全 findings 聚合、AI 解读（Sheet） |
| 性能分析 | `performance` | 性能 findings、**行内 AI 优化**（SSE） |
| 架构洞察 | `architecture` | 依赖图扫描、仓库级架构 AI 分析 |
| 工程治理 | `governance` | 规则与违规、审计日志 |
| 仓库管理 | `repos` | 仓库列表、GitHub 同步、仓库级 AI 分析 |
| 团队质量 | `team` | 成员与质量画像 |
| 系统设置 | `settings` | AI 模型、集成测试、密钥轮换 |

**技术分工：**

- **Web**（`apps/web`）：Next.js 单页应用，通过 rewrite 访问网关，不直连数据库。
- **Gateway**（`services/gateway`）：**唯一 REST 入口**；ORM、GitHub、LLM 代理、任务编排。
- **Engine**（`services/engine`）：C++ gRPC；diff 解析、规则扫描、依赖图（开发默认可 stub）。
- **Shared**（`packages/shared`）：前后端共享的 TypeScript 类型。
- **Contracts**（`packages/contracts`）：OpenAPI + protobuf 契约。

---

## 2. 系统架构

```mermaid
flowchart TB
  subgraph client [浏览器]
    Web["apps/web :3000"]
  end

  subgraph backend [后端]
    GW["gateway FastAPI :3001"]
    Engine["engine gRPC :50051"]
    DB[("PostgreSQL / SQLite")]
    GH["GitHub API"]
    LLM["LLM Providers"]
  end

  Web -->|"/api/* rewrite"| GW
  GW --> DB
  GW --> Engine
  GW --> GH
  GW --> LLM
```

**请求路径：**

1. 浏览器访问 `http://localhost:3000`，前端 `fetch("/api/...")`。
2. Next.js `rewrites` 将 `/api/*` 转发到 `API_URL`（默认 `http://localhost:3001`）。
3. Gateway 处理业务逻辑；需要 diff/图时调用 Engine（`PRISM_STUB_ENGINE=1` 时用内存 stub）。

**职责边界（摘要）：**

| 能力 | Gateway (Python) | Engine (C++) |
|------|------------------|--------------|
| REST / 鉴权 / 错误格式 | ✓ | ✗ |
| DB、GitHub、Settings 加密 | ✓ | ✗ |
| LLM 调用与 SSE 流式 | ✓ | ✗ |
| Job 状态机、findings 落库 | ✓ | 参与 |
| patch → DiffFile[] | 调用 | 实现 |
| 依赖图 / 规则扫描 | 调用 | 实现 |

---

## 3. 仓库目录结构

```
Reviewly/
├── apps/
│   └── web/                          # Next.js 16 + React 19 前端
│       ├── src/
│       │   ├── app/                  # App Router（page.tsx 为 PRism 壳）
│       │   ├── features/prism/       # 业务 UI（views / components / contexts）
│       │   ├── hooks/                # 数据与领域 hooks
│       │   └── lib/                  # api client、i18n、工具
│       └── next.config.mjs           # /api → gateway rewrite
│
├── services/
│   ├── gateway/                      # FastAPI
│   │   ├── app/
│   │   │   ├── api/v1/               # 路由层
│   │   │   ├── repositories/         # 数据访问 / DTO 映射
│   │   │   ├── services/             # 业务编排（同步、分析、LLM）
│   │   │   ├── github/               # App / PAT / webhook / sync
│   │   │   ├── grpc_client/          # 调用 engine
│   │   │   ├── db/                   # SQLAlchemy models、seed
│   │   │   └── mock/                 # 演示 seed 数据
│   │   ├── alembic/                  # 数据库迁移
│   │   └── tests/
│   └── engine/                       # C++ gRPC 服务
│
├── packages/
│   ├── shared/                       # @reviewly/shared 类型
│   └── contracts/                    # OpenAPI + proto
│
├── docs/
│   ├── plan.md                       # 产品/后端里程碑 P0–P10、B0–B10
│   └── DEVELOPER_GUIDE.md            # 本文档
│
├── scripts/                          # dev-gateway.ps1、start.ps1 等
├── docker-compose.yml                # PostgreSQL 16
└── package.json                      # npm workspaces 根脚本
```

---

## 4. 环境要求与快速启动

### 4.1 环境要求

| 工具 | 版本建议 |
|------|----------|
| Node.js | 18+（推荐 20+） |
| npm | 9+ |
| Python | 3.11+ |
| PostgreSQL | 16（可选，可用 SQLite） |
| CMake + C++ 编译器 | 仅构建 engine 时需要 |

### 4.2 一键启动（推荐）

```bash
# 仓库根目录
npm install
npm run dev          # 同时启动 Web :3000 + Gateway :3001
```

或使用 PowerShell 一键脚本（含打开浏览器）：

```bash
npm run start:app
```

- **前端**：http://localhost:3000  
- **API**：http://localhost:3001（也可经前端 `/api` 代理访问）  
- **健康检查**：http://localhost:3001/health  

`npm run dev:gateway` 会：

1. 创建/使用 `services/gateway/.venv`
2. 安装 `requirements.txt`
3. 加载 `.env`
4. 执行 `alembic upgrade head`
5. 启动 uvicorn（`--reload --reload-dir app --reload-exclude "data/*"`，避免 `data/repo-cache` 克隆/扫描触发无限重载）

手动启动 Gateway 时使用相同参数：

```powershell
cd services/gateway
.venv\Scripts\python -m uvicorn app.main:app --port 3001 --reload --reload-dir app --reload-exclude "data/*"
```

### 4.3 数据库初始化

**方式 A：PostgreSQL（推荐团队环境）**

```bash
docker compose up -d          # 根目录，启动 postgres:5432
cd services/gateway
cp .env.example .env          # 确认 DATABASE_URL 指向 Postgres
alembic upgrade head
```

**方式 B：SQLite（本地无 Docker）**

在 `services/gateway/.env` 中：

```env
DATABASE_URL=sqlite:///./prism.db
```

然后 `alembic upgrade head`（`dev-gateway.ps1` 会自动执行）。

**演示数据（可选）：**

默认**不会**自动灌入演示数据。仅当 `PRISM_SEED_DB=1` 时，Gateway 启动才会在空库执行 `load_seed_if_empty()`（写入 `app/mock/seed.py` 中的 acme 演示仓库/PR）。正常开发请使用 GitHub OAuth 登录后「同步 GitHub 仓库」。

若库中已有旧版演示数据，可执行一次清理：

```bash
cd services/gateway
$env:PYTHONPATH='.'; .venv\Scripts\python.exe scripts\purge_seed_data.py
```

### 4.4 仅启动各服务

```bash
npm run dev -w @reviewly/web     # 仅前端
npm run dev:gateway              # 仅网关
npm run dev:engine               # 仅 C++ 引擎（可选）
npm run build                    # 构建 shared + web
```

---

## 5. 配置说明

配置文件：`services/gateway/.env`（参考 `.env.example`）。

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | `postgresql+psycopg://prism:prism@localhost:5432/prism` 或 `sqlite:///./prism.db` |
| `PRISM_STUB_ENGINE` | `1` = 不依赖 C++ 进程，使用网关内 stub（**开发默认**） |
| `ENGINE_GRPC_ADDR` | 引擎地址，默认 `localhost:50051` |
| `APP_URL` | 前端地址，用于回调等 |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` | GitHub App（安装后 webhook 同步仓库+PR） |
| `GITHUB_WEBHOOK_SECRET` | Webhook 签名校验 |
| `GITHUB_APP_SLUG` | 安装链接 slug |
| `GITHUB_PAT` | 个人 Token；用于 PAT 同步、公开 README、PR 导入（**强烈建议配置**，否则易 403 限流） |
| `SETTINGS_ENCRYPTION_KEY` | 64 位 hex，用于服务端加密存储敏感设置（`openssl rand -hex 32`） |

前端可选环境变量（`apps/web`）：

| 变量 | 说明 |
|------|------|
| `API_URL` | rewrite 目标，默认 `http://localhost:3001` |

**AI API Key：** 当前主要在浏览器 **系统设置** 中配置（`AISettingsProvider` → localStorage），请求 `POST /api/ai/chat` 时由前端带入；部分 SSE 端点（安全解读、性能优化）由网关从 settings 解析配置。

---

## 6. 数据与持久化

### 6.1 核心表（SQLAlchemy）

定义见 `services/gateway/app/db/models.py`：

| 表 | 用途 |
|----|------|
| `teams` / `users` | 团队与成员（payload JSON） |
| `repositories` | 仓库；`payload` 元数据，`settings` 存 AI 分析 |
| `pull_requests` | PR 列表项与风险分 |
| `pull_request_diffs` | patch 与解析后的 files |
| `analysis_jobs` / `analysis_findings` | PR 分析任务与发现项 |
| `governance_rules` / `governance_violations` | 治理规则 |
| `settings` | 应用级设置（含 dashboard 周报等） |

迁移版本：`alembic/versions/001` … `004`（含 `repositories.architecture_graph` 等）。

### 6.2 持久化分层

| 数据类型 | 存储位置 | 生命周期 |
|----------|----------|----------|
| 仓库列表、PR、findings | PostgreSQL / SQLite | 服务端持久 |
| 仓库 `aiAnalysis` / `aiArchitectureAnalysis` | `repositories.settings` JSON | 服务端持久 |
| Finding 级 `aiInsight` / `aiOptimization` | finding `payload` 内 | 服务端持久 |
| Dashboard 周报 | `settings.data.dashboard.weeklySummary` | 服务端持久 |
| 各视图筛选、展开行 | `sessionStorage`（`prism:view:*`） | **仅当前浏览器会话** |
| AI Provider / API Key | 浏览器 localStorage | 客户端（待 B10 全面服务端化） |

提取 AI 持久化字段的共用逻辑：`app/repositories/ai_persisted.py`。

### 6.3 前端 API 客户端

- 统一入口：`apps/web/src/lib/api/client.ts` → `apiFetch<T>(path, options)`
- 按领域拆分：`lib/api/dashboard.ts`、`repos.ts`、`analysis.ts`、`security.ts`、`performance.ts` 等
- 错误类型：`PrismApiError`（解析网关 `{ "error": "..." }`）

---

## 7. 仓库与 PR 如何进入系统

### 7.1 仓库来源

```mermaid
flowchart LR
  Seed[启动时空库 Seed] --> DB[(repositories)]
  Sync[POST /api/repos/sync] --> DB
  Webhook[GitHub Webhook] --> SyncInstall[sync_installation] --> DB
  Import[POST /api/pull-requests/import] --> DB
```

1. **OAuth 同步（推荐）**：登录后 `POST /api/repos/sync/me`，使用用户 GitHub token。  
2. **PAT 同步（兼容）**：`POST /api/repos/sync`，需配置 `GITHUB_PAT`。  
3. **演示 Seed（仅 `PRISM_SEED_DB=1`）**：空库时导入 mock 数据，仅供 demo。  
4. **按 URL 添加仓库**：`POST /api/repos/import`，body `{ "url": "https://github.com/owner/repo" }`。  
4. **GitHub App**：`installation` / `pull_request` webhook → `app/github/sync.py` 写入仓库与 PR（含 diff）；无 PAT 时若库中已有 installation_id 可走 App 路径同步。

仓库主键格式：`repo-{github_numeric_id}`。`upsert_repo` 见 `app/repositories/repos.py`。

### 7.2 PR 来源

- GitHub 同步（开放 PR + diff patch，`POST /api/repos/{id}/sync-prs`）  
- **按 URL 导入**：`POST /api/pull-requests/import`，body `{ "url": "https://github.com/owner/repo/pull/123" }`（建议配置 `GITHUB_PAT`）

### 7.3 本地克隆缓存

架构扫描等需要工作区时：`POST /api/repos/{repo_id}/clone` → `app/services/repo_clone.py`，缓存目录由 `PRISM_REPO_CACHE_DIR` 控制（默认 `./data/repo-cache`）。

---

## 8. 前端开发指南

### 8.1 应用壳与路由

- 入口：`apps/web/src/app/page.tsx`  
- **无文件系统路由切换**：使用 `NavigationProvider` 的 `activeView` + `prId` 在单页内切换视图（类 SPA）。  
- 视图注册：`features/prism/components/view-registry.tsx`  

Provider 嵌套（外层 → 内层）：

```
AISettingsProvider
  → NavigationProvider
    → AIReviewSessionProvider
      → ReposProvider
        → PRismPageContent
```

`ReposProvider` 包裹全应用，保证仓库分析结果在切换侧边栏后仍可访问。

### 8.2 目录约定

| 路径 | 职责 |
|------|------|
| `features/prism/views/*-view.tsx` | 页面级容器，组合 hooks + 组件 |
| `features/prism/components/` | 可复用 UI（表格、Diff、图表等） |
| `features/prism/contexts/` | 跨视图状态（导航、AI 设置、仓库） |
| `hooks/use-*.ts` | 数据获取、SSE、持久化视图状态 |
| `lib/i18n/zh.ts` | 中文文案集中管理 |

### 8.3 主要 Hooks

| Hook | 用途 |
|------|------|
| `use-dashboard` / `use-weekly-summary` | 总览与周报 |
| `use-pull-requests` / `use-pull-request` / `use-pull-request-diff` | PR 列表与详情 |
| `use-pr-analysis` | 发起/轮询 PR 分析 job |
| `use-security-center` | 安全 findings + AI 解读 SSE + PATCH |
| `use-performance-center` | 性能 findings + **行内优化**（`startOptimize` / `expandedFindingId`） |
| `use-architecture` / `use-architecture-analyze` | 架构图与 AI 分析 |
| `use-repos` / `useReposStore` | 仓库列表（后者来自 context，含同步与分析） |
| `use-persisted-view-state` | sessionStorage 筛选/展开状态 |
| `use-governance` / `use-team` | 治理与团队 |

### 8.4 UI 与样式

- 暗色 DevTools 主题，语义 token 见 `apps/web/src/app/globals.css`（`bg-background`、`text-ai-blue`、`text-risk-high` 等）。  
- 组件库：shadcn/ui（`components/ui/`）。  
- 规范：`.cursor/rules/project-code-standards.mdc`（类型安全、空态/加载态、禁止随意新增 hex 色）。  

### 8.5 代理与本地联调

`next.config.mjs`：

```javascript
async rewrites() {
  const apiOrigin = process.env.API_URL ?? "http://localhost:3001"
  return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }]
}
```

修改网关端口时，设置 `API_URL` 或改默认即可。

---

## 9. 后端开发指南

### 9.1 分层结构

```
api/v1/*.py          # HTTP 路由，参数校验，依赖注入 get_db
    ↓
repositories/*.py    # 查询与 ORM → API dict 映射
    ↓
services/*.py        # 业务流程（同步、分析 job、LLM SSE）
    ↓
db/models.py         # SQLAlchemy 模型
github/              # 外部 GitHub 集成
grpc_client/         # Engine 客户端（含 stub）
```

新增 REST 接口建议：

1. 在 `packages/shared` 补充类型（若前端需要）。  
2. 在 `repositories` 实现数据访问。  
3. 在 `services` 编写可单测的业务逻辑。  
4. 在 `api/v1` 注册路由，并在 `router.py` include。  

### 9.2 关键服务模块

| 模块 | 文件 | 说明 |
|------|------|------|
| PR 分析 Job | `services/analysis_jobs.py` | 创建 job、后台 `run_job`、findings 落库 |
| 仓库同步 | `services/repo_sync.py` | GitHub 元数据同步 |
| GitHub 全量同步 | `github/sync.py` | 安装维度同步 PR + diff |
| Dashboard 周报 | `services/dashboard_summary.py` | LLM 生成并持久化 |
| 安全解读 SSE | `services/security_explain.py` | |
| 性能优化 SSE | `services/performance_optimize.py` | |
| 架构扫描 | `services/architecture_scan.py` | 克隆 + 解析 + 图写入 DB |
| LLM 代理 | `app/ai/*` + `api/v1/ai.py` | 多 Provider chat |

### 9.3 错误处理

统一使用 `app/core/errors.py` 的 `api_error(message, status_code)`，返回 JSON `{ "error": "..." }`，与前端 `PrismApiError` 对齐。

### 9.4 Mock 与 Seed

- `app/mock/seed.py`：演示用仓库、PR、治理、设置。  
- 测试：`tests/conftest.py` 使用内存 SQLite + `load_seed_if_empty`。  

---

## 10. C++ 分析引擎

- 路径：`services/engine/`  
- gRPC 定义：`packages/contracts/proto/`  
- 网关客户端：`app/grpc_client/engine.py`（`PRISM_STUB_ENGINE=1` 时返回与 seed 一致的 stub 结果）  

构建与运行详见 `services/engine/README.md`（若存在）或 `npm run dev:engine`。

生产路径：Gateway 将 PR patch 发给 Engine `ParseDiff`，分析流水线 `RunAnalysis`（流式），架构 `BuildDependencyGraph`。

---

## 11. REST API 一览

基址：`http://localhost:3001`（或经前端 `/api`）。以下按领域分组，**非完整 OpenAPI**；权威契约见 `packages/contracts/openapi/prism-v1.yaml`。

### 健康与集成

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务与数据库类型 |
| POST | `/api/repos/import` | 按 GitHub URL 添加单个仓库 |
| POST | `/api/repos/sync` | 同步 PAT 用户可见仓库（分页，返回 synced/created/updated） |
| GET | `/api/integrations/github/install-url` | App 安装链接 |
| POST | `/api/webhooks/github` | GitHub Webhook |
| POST | `/api/settings/test-integration` | 集成测试 |
| POST | `/api/settings/rotate-secret` | 轮换加密密钥 |

### 总览与设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard` | 仪表盘数据 |
| POST | `/api/dashboard/weekly-summary` | 生成周报（LLM） |
| GET/PATCH | `/api/settings` | 应用设置 |

### 仓库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/repos` | 仓库列表 |
| GET | `/api/repos/{id}/analyze-context` | 分析上下文（README + findings） |
| PUT | `/api/repos/{id}/ai-analysis` | 持久化仓库 AI 分析 |
| PUT | `/api/repos/{id}/architecture-analysis` | 持久化架构 AI 分析 |
| POST | `/api/repos/{id}/clone` | 克隆到本地缓存 |

### 合并请求与分析

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/pull-requests` | PR 列表（query: repo, risk, state…） |
| POST | `/api/pull-requests/import` | 从 GitHub URL 导入 |
| GET | `/api/pull-requests/{id}` | PR 详情 |
| GET | `/api/pull-requests/{id}/diff` | Diff 文件列表 |
| POST | `/api/pull-requests/{id}/analysis` | 启动分析 job |
| GET | `/api/pull-requests/{id}/analysis/latest` | 最新分析摘要 |
| GET | `/api/pull-requests/{id}/findings` | Findings |
| GET | `/api/analysis/jobs/{job_id}` | Job 状态 |

### 安全 / 性能（中心）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/security/findings` | 分页列表 |
| GET | `/api/security/stats` | 统计 |
| POST | `/api/security/findings/{id}/explain` | AI 解读（SSE） |
| PATCH | `/api/security/findings/{id}` | 更新（含 `aiInsight`） |
| GET | `/api/performance/findings` | 分页列表 |
| POST | `/api/performance/findings/{id}/optimize` | AI 优化（SSE） |
| PATCH | `/api/performance/findings/{id}` | 更新（含 `aiOptimization`） |

### 架构

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/architecture/scan` | 扫描仓库依赖图 |
| GET | `/api/architecture/repos/{id}/graph` | 读取已存图 |
| POST | `/api/architecture/repos/{id}/analyze` | 架构 AI 分析（SSE） |

### 治理与团队

| 方法 | 路径 | 说明 |
|------|------|------|
| CRUD | `/api/governance/rules` | 规则 |
| GET | `/api/governance/violations` | 违规 |
| GET/POST | `/api/governance/audit-logs` | 审计 |
| CRUD | `/api/team/members` | 成员 |

### AI 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/chat` | 通用 LLM 代理（body 含 provider、model、apiKey、messages） |

---

## 12. AI 能力与持久化

### 12.1 调用方式

| 场景 | 端点 | 前端入口 |
|------|------|----------|
| 通用对话 / 仓库分析 | `POST /api/ai/chat` | `AISettingsProvider` + 各 view |
| PR 分析 | `POST .../analysis` + job 轮询 | `use-pr-analysis` |
| 安全解读 | `POST .../explain`（SSE） | `use-security-center` |
| 性能优化 | `POST .../optimize`（SSE） | `use-performance-center` |
| 架构分析 | `POST /api/architecture/repos/{id}/analyze` | `use-architecture-analyze` |
| 周报 | `POST /api/dashboard/weekly-summary` | `use-weekly-summary` |

SSE 事件格式一般为 `data: {"delta":"..."}\n\n`，结束 `data: [DONE]\n\n`。

### 12.2 持久化约定

持久化结构 `AiPersistedContent`（`packages/shared`）：

```typescript
{
  content: string
  analyzedAt: string   // ISO 时间
  model?: string
  provider?: string
}
```

| 场景 | 写入方式 |
|------|----------|
| 性能 finding 优化 | 流式结束后 `PATCH` finding，`payload.aiOptimization` |
| 安全 finding 解读 | 同上，`aiInsight` |
| 仓库分析 | `PUT /api/repos/{id}/ai-analysis` |
| 架构 AI 报告 | `PUT /api/repos/{id}/architecture-analysis` |

**性能分析 UX：** 点击「AI 优化」→ 行内展开（`expandedFindingId` 存 session）；有缓存只展示，无缓存立即 SSE；「重新生成」强制重新调用 LLM。

---

## 13. 测试与质量检查

### Gateway（pytest）

```bash
cd services/gateway
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt pytest
.venv\Scripts\pytest
```

覆盖示例：`test_health.py`、`test_b2_persistence.py`、`test_b3_github.py`、`test_repo_management.py`、`test_ai_persisted.py` 等。

### Web

```bash
cd apps/web
npm run build          # TypeScript + Next 构建
```

根目录 `npm run lint` 当前为占位；以 `npm run build` 与 IDE 诊断为准。

### Engine

```bash
# 见 services/engine 下 CMake 目标与 tests/
```

---

## 14. 常见开发任务

### 新增侧边栏页面

1. 在 `sidebar.tsx` 的 `NavView` 联合类型中增加 id。  
2. 新建 `views/xxx-view.tsx`。  
3. 在 `view-registry.tsx` 的 `switch` 中挂载。  
4. 如需 API：gateway 路由 + `lib/api` + hook。

### 新增 REST 接口并给前端用

1. `repositories` → `services` → `api/v1`  
2. `packages/shared/src/types/api.ts` 补充类型  
3. `apps/web/src/lib/api/*.ts` 增加 `apiFetch` 封装  
4. 新建或扩展 `use-*.ts` hook  

### 连接真实 GitHub 仓库

1. 配置 `services/gateway/.env` 中 `GITHUB_PAT` 或 GitHub App 全套变量。  
2. 重启 gateway。  
3. 打开 **仓库管理** → **同步仓库**。  
4. 或在 **合并请求** 使用「导入 PR」粘贴 GitHub PR URL。

### 重置为演示数据

在 `.env` 设置 `PRISM_SEED_DB=1`，清空数据库后重启 gateway，将执行 `load_seed_if_empty`。

### 清理演示数据、仅保留真实数据

```bash
cd services/gateway
$env:PYTHONPATH='.'; .venv\Scripts\python.exe scripts\purge_seed_data.py
```

然后重启 gateway（保持 `PRISM_SEED_DB=0`）。

---

## 15. 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| Dashboard 500，`architecture_graph` 不存在 | 迁移未执行 | `cd services/gateway && alembic upgrade head` |
| 端口 3001 被占用 | 旧 uvicorn 未退出 | 结束占用进程或换端口 |
| GitHub 导入/同步 403 | 未配置 PAT、API 限流 | 设置 `GITHUB_PAT` |
| 同步按钮后仍无仓库 | 未登录 OAuth 或未配置 PAT | 登录 GitHub 或设置 `GITHUB_PAT` 后同步 |
| 仍看到 acme 演示仓库 | 库内残留 seed 行 | 运行 `scripts/purge_seed_data.py` |
| 分析无 diff | DB 无 patch / stub 未返回 | 检查 `pull_request_diffs`、Engine 是否 stub |
| 前端 API 404 | 网关未启动或 `API_URL` 错误 | 确认 `npm run dev:gateway` 与 rewrite |
| PR URL 导入 500，Gateway 无 POST 日志 | 旧版仅 rewrite 透明代理、无请求日志 | 见 [import-pr-call-chain.md](./diagnostics/import-pr-call-chain.md)；设置 `DEBUG=true` 与 `NEXT_PUBLIC_DEBUG_API=1` 后重启 |
| Postgres 连接失败 | Docker 未启动 | `docker compose up -d` 或改 SQLite |

---

## 16. 代码规范与相关文档

| 文档 | 说明 |
|------|------|
| [plan.md](./plan.md) | 产品阶段、B0–B10 后端里程碑、数据模型附录 |
| [diagnostics/import-pr-call-chain.md](./diagnostics/import-pr-call-chain.md) | PR URL 导入全链路诊断与 500 定位 |
| [README.md](../README.md) | 简短快速开始 |
| `.cursor/rules/project-code-standards.mdc` | PRism 前端代码规范（必读本仓库 UI 约定） |
| `packages/contracts/openapi/prism-v1.yaml` | OpenAPI 契约 |
| `AGENTS.md` | Agent / Skills 说明 |

**类型同步原则：** 改 API 形状时，优先更新 `packages/shared`，再改 gateway 与 web，避免前后端字段漂移。

---

## 附录：默认端口与服务

| 服务 | 端口 |
|------|------|
| Web | 3000 |
| Gateway | 3001 |
| Engine gRPC | 50051 |
| PostgreSQL | 5432 |

---

*文档随代码演进更新；若发现与实现不一致，请以仓库内源码为准并提交 PR 修正本文档。*
