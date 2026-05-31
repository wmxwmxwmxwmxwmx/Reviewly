# Reviewly (PRism)

企业级 AI Pull Request 智能评审平台。采用 **Next.js BFF + FastAPI Gateway** 架构：浏览器只访问前端，GitHub、AI 与业务逻辑均由 Gateway 处理。

| 层级 | 技术 | 默认端口 |
|------|------|----------|
| 前端 | Next.js 16、React 19、Tailwind CSS 4 | 3000 |
| API 网关 | Python FastAPI、SQLAlchemy、Alembic | 3001 |
| 数据库 | PostgreSQL 16（开发可 SQLite） | 5432 |
| 分析引擎 | C++20、gRPC（可选，开发默认 stub） | 50051 |

**架构原则**

- Next.js：UI + BFF，通过 `/api/*` 转发至 Gateway（部分长连接/SSE 走 Route Handler）。
- Gateway：仓库、PR、分析、治理、Webhook、加密 AI 配置等全部后端能力。
- 禁止浏览器直连 GitHub 或 LLM 提供商。

详细说明见 [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)。

---

## 目录

- [环境要求](#环境要求)
- [本地开发](#本地开发)
- [生产部署（Docker）](#生产部署docker)
- [环境变量](#环境变量)
- [项目结构](#项目结构)
- [常用命令](#常用命令)
- [常见问题](#常见问题)

---

## 环境要求

| 场景 | 依赖 |
|------|------|
| 本地开发 | Node.js 20+、npm 9+、Python 3.11+ |
| 生产部署 | [Docker Desktop](https://www.docker.com/products/docker-desktop/)（或 Docker Engine + Compose v2） |
| C++ 引擎（可选） | CMake 3.20+、C++ 编译器；生产镜像见 `deploy/Dockerfile.engine` |

---

## 本地开发

```bash
# 安装依赖
npm install

# 同时启动 Web (:3000) 与 Gateway (:3001)
npm run dev
```

| 地址 | 说明 |
|------|------|
| http://localhost:3000 | Web 前端 |
| http://localhost:3001 | API 网关 |
| http://localhost:3001/health | 健康检查（`migrations` 应为 `ok`） |
| http://localhost:3001/docs | OpenAPI 文档 |

**仅启动 Gateway**

```bash
npm run dev:gateway
# 脚本会自动执行 alembic upgrade head
```

**仅启动数据库（PostgreSQL）**

```bash
docker compose up -d
cd services/gateway && alembic upgrade head
```

**C++ 引擎（可选）**

```bash
npm run dev:engine
# 开发默认 PRISM_STUB_ENGINE=1，无需启动引擎进程
```

**数据库迁移异常**

```bash
cd services/gateway
python scripts/repair_migration_drift.py   # 可选：修复版本漂移
alembic upgrade head
```

**AI 配置**：Web → **系统设置** → **AI 模型配置**。API Key 加密存入数据库，不要写入 `OPENAI_API_KEY` 等环境变量。

---

## 生产部署（Docker）

`deploy/` 提供全栈容器化部署：PostgreSQL + Gateway + Web + C++ 引擎。

> PRism 含多个运行时，**无法**打包为单个 `.exe` 内嵌全部依赖。需先安装并启动 Docker，再通过下方入口一键部署。

### 一键入口

| 平台 | 操作 |
|------|------|
| Windows | 双击根目录 **`deploy.bat`** 或 **`deploy.cmd`** |
| 全平台 | `npm run deploy` |
| Linux / macOS | `chmod +x deploy.sh && ./deploy.sh` |

脚本将：检查 Docker 与端口 → 生成/合并 `deploy/.env` → 构建镜像 → 按序启动 **PostgreSQL → Gateway + Engine → Web**。

### 部署后访问

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| API | http://localhost:3001 |
| API 文档 | http://localhost:3001/docs |

### 前置条件

- Docker 守护进程已运行
- 端口 **3000 / 3001 / 5432** 未被占用
- 首次构建约 10–30 分钟（视网络与 CPU）

### 部署环境变量

模板：`deploy/.env.example`。首次运行会将 `services/gateway/.env` 中已有项合并进 `deploy/.env`（AI Key、OAuth 等）。`deploy/.env` 已 gitignore，勿提交密钥。

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 容器内：`postgresql+psycopg://prism:prism@postgres:5432/prism` |
| `API_URL` | Web 构建时 `/api` 代理目标，默认 `http://gateway:3001` |
| `ENGINE_GRPC_ADDR` | 引擎地址，默认 `engine:50051` |
| `PRISM_STUB_ENGINE` | `0` 使用 C++ 引擎；`1` 使用 Python stub |
| `JWT_SECRET` / `SETTINGS_ENCRYPTION_KEY` | `openssl rand -hex 32` 生成 |

### 运维命令

```bash
# 状态 / 日志 / 停止
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs -f
docker compose -f deploy/docker-compose.yml down

# 停止并清空数据卷
docker compose -f deploy/docker-compose.yml down -v
```

### 验证

```bash
curl http://localhost:3001/health
curl -I http://localhost:3000/
docker compose -f deploy/docker-compose.yml ps
```

### 部署目录

```
deploy/
├── .env.example
├── docker-compose.yml
├── Dockerfile.gateway / Dockerfile.web / Dockerfile.engine
├── entrypoint-gateway.sh
├── deploy.sh / deploy.ps1
└── Caddyfile              # 可选 HTTPS（默认注释）
```

根目录 `docker-compose.yml` **仅 PostgreSQL**（开发用）；完整生产栈使用 `deploy/docker-compose.yml`。

---

## 环境变量

### Gateway — `services/gateway/.env`

从 `services/gateway/.env.example` 复制。

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 或 `sqlite:///./prism.db` |
| `GITHUB_PAT` | GitHub API Token，提高导入/同步限额 |
| `SETTINGS_ENCRYPTION_KEY` | 加密数据库中的 AI Key（32 字节 hex） |
| `JWT_SECRET`、`GITHUB_OAUTH_*` | OAuth；开发可设 `PRISM_AUTH_BYPASS=1` |
| `PRISM_STUB_ENGINE` | `1` 不连接 C++ 引擎（开发默认） |

### Web — `apps/web/.env`

从 `apps/web/.env.example` 复制。

| 变量 | 说明 |
|------|------|
| `API_URL` | BFF 代理目标，默认 `http://127.0.0.1:3001` |
| `NEXT_PUBLIC_DEBUG_API` | `1` 开发环境打印 API 日志 |
| `NEXT_PUBLIC_PRISM_AUTH_BYPASS` | `1` 本地免 OAuth |

---

## 项目结构

```
Reviewly/
├── apps/web/                 # Next.js 前端
├── services/
│   ├── gateway/              # FastAPI 网关
│   └── engine/               # C++ 分析引擎
├── packages/
│   ├── shared/               # 共享 TypeScript 类型
│   └── contracts/            # OpenAPI + Protobuf
├── deploy/                   # 生产 Docker 全栈
├── deploy.bat / deploy.cmd / deploy.sh
├── docker-compose.yml        # 开发：仅 PostgreSQL
├── docs/                     # 开发者指南、路线图
└── scripts/                  # 开发/部署脚本
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | Web + Gateway |
| `npm run dev:gateway` | 仅 Gateway |
| `npm run dev:engine` | 仅 C++ 引擎 |
| `npm run deploy` | **生产**：Docker 全栈（同 `deploy.bat`） |
| `npm run build` | 构建 shared + web |
| `npm run lint` | ESLint + TypeScript 检查 |
| `npm run test` | Gateway pytest |
| `npm run dev:clean` | 释放 3000/3001 端口并重启 |
| `npm run start:app` | 一键启动并打开浏览器 |

---

## 常见问题

| 现象 | 处理 |
|------|------|
| Gateway 3001 启动失败 | `npm run kill:gateway` 或 `npm run dev:clean`；执行 `alembic upgrade head` |
| GitHub 限流 | 配置 `GITHUB_PAT` 或使用 GitHub OAuth 登录 |
| Docker 部署失败 | 确认 Docker 已运行；`docker compose -f deploy/docker-compose.yml logs gateway` |
| Engine 镜像构建失败 | 在 `deploy/.env` 设 `PRISM_STUB_ENGINE=1` 后重启 gateway |
| 流式响应卡住 | 确保仅一个 Gateway 实例；长连接走 BFF 路由 |
| Dashboard / 导入 500 | 检查 `/health` 中 `migrations`；执行迁移后重启 Gateway |

---

## 许可证

Private / internal use unless otherwise noted.
