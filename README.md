# PRism

**PRism** 是企业级 AI Pull Request 智能评审平台（Reviewly 仓库）。采用暗色 DevTools 风格 UI，覆盖 PR 评审、安全分析、性能评估、架构洞察与工程治理等维度。

> 当前阶段：Monorepo 前后端分离；前端 Next.js + Python FastAPI 网关 + C++ 分析引擎（开发默认引擎 stub）。

## 功能模块

| 模块 | 说明 | 数据状态 |
|------|------|----------|
| 总览面板 | 质量指标与趋势 | API（B0 mock） |
| 合并请求 | PR 列表与筛选 | API + 部分 UI mock |
| AI 评审 | Diff 展示 + AI 摘要/分析 | Mock diff + 真实 AI（需 API Key） |
| 安全中心 | 漏洞与 CWE 分类 | API mock |
| 性能 / 架构 / 治理 / 团队 | 各维度分析 | Mock / 占位 API |
| 系统设置 | AI 模型配置 | localStorage + API settings |

## 技术栈

| 层级 | 技术 |
|------|------|
| Monorepo | npm workspaces（`apps/web`、`packages/*`） |
| 前端 | Next.js 16、React 19、TypeScript、Tailwind CSS 4 |
| 网关 | Python 3.11+、FastAPI（`services/gateway`，:3001） |
| 引擎 | C++20、gRPC（`services/engine`，:50051，可选） |
| 契约 | `packages/contracts`（OpenAPI + protobuf） |
| 共享类型 | `@reviewly/shared` |

## 环境要求

- Node.js 18+（推荐 20+）
- Python 3.11+
- npm 9+
- （可选）CMake 3.20+、C++ 编译器，用于构建 `services/engine`

## 快速开始

```bash
# 安装前端依赖
npm install

# 同时启动 Web（:3000）与 Python Gateway（:3001）
npm run dev

# 一键启动（自动打开浏览器）
npm run start:app
```

- **Web 前端**：http://localhost:3000
- **API 网关**：http://localhost:3001

### 仅启动 Gateway

```bash
npm run dev:gateway
# 推荐：脚本会自动执行 alembic upgrade head
```

若直接运行 uvicorn，Gateway 启动时也会尝试执行迁移；若失败请手动：

```bash
cd services/gateway
alembic upgrade head
.venv\Scripts\python -m uvicorn app.main:app --port 3001 --reload --reload-dir app --reload-exclude "data/*"
```

拉取含数据库变更的代码后，若 Dashboard 返回「服务器内部错误」，请先执行 `alembic upgrade head`。

### C++ 引擎（可选）

```bash
npm run dev:engine
# 详见 services/engine/README.md
```

开发默认 `PRISM_STUB_ENGINE=1`，无需启动 C++ 进程。

### PostgreSQL（B2+）

```bash
docker compose up -d
cd services/gateway
alembic upgrade head
```

## AI 配置

1. 打开 Web → **系统设置** → **AI 模型设置**
2. 填写 Provider、Model、API Key
3. 在 **AI 评审** 页发起分析

`POST /api/ai/chat` 由 Python 网关代理；API Key 仍由浏览器 localStorage 传入请求体（B10 将改为服务端加密存储）。

## 项目结构

```
Reviewly/
├── apps/web/                 # Next.js 前端
├── services/
│   ├── gateway/              # Python FastAPI REST
│   └── engine/               # C++ 分析核心
├── packages/
│   ├── shared/               # TS 类型
│   └── contracts/            # OpenAPI + proto
├── docs/plan.md              # 路线图 P0–P10 / B0–B10
├── docker-compose.yml
└── scripts/
    ├── start.ps1
    ├── dev-gateway.ps1
    └── dev-engine.ps1
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | Web + Gateway |
| `npm run dev:gateway` | 仅 Python API |
| `npm run dev:engine` | 仅 C++ 引擎（stub 模式） |
| `npm run build` | 构建 shared + web |
| `npm run start:app` | 一键启动 |

Gateway 测试：`cd services/gateway && .venv\Scripts\pip install -r requirements.txt pytest && .venv\Scripts\pytest`

## 开发者文档

新同学请先阅读 **[docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)**（架构、目录、配置、API、数据流与排错）。

## 路线图

详见 [docs/plan.md](docs/plan.md)。
