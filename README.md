# Reviewly (PRism)

> 企业级 AI Pull Request 智能评审平台

采用 **Next.js BFF + FastAPI Gateway** 架构：浏览器只访问前端，GitHub、AI 与业务逻辑均由 Gateway 处理。

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

## 项目展示

公开展示视频（哔哩哔哩）：**[飞牛 AI PR Review 项目展示](https://www.bilibili.com/video/BV1ZoVD6VEMR/)**

## 快速开始（评委 / 演示）

仓库已内置 `deploy/.env` 与 GitHub OAuth，**克隆后无需手填** `GITHUB_OAUTH_CLIENT_ID` / `SECRET`。

```bash
git clone <仓库地址> Reviewly && cd Reviewly
bash install.sh
```

> **平台说明**：一键安装/部署仅支持 **Linux**。Windows 请使用 WSL，或参考 [本地开发](#本地开发) 中的 `dev:local` 模式。

启动后打开 http://localhost:3000 → **使用 GitHub 登录**。

需换号时：登录页 **「使用其他 GitHub 账号登录」** 进入分流页，选 **「切换账号（推荐）」**；若仍为同一 GitHub 用户，系统会自动尝试一次强制重登。已登录用户也可在右上角 **「切换账号」** 发起。详见 [多 GitHub 账号登录](#多-github-账号登录)。

> GitHub OAuth App 的 Callback 须为 `http://localhost:3001/api/auth/github/callback`（已在演示配置中）。**勿将本仓库公开到公网**（含 Client Secret）；正式环境请更换密钥。

---

## 目录

- [项目展示](#项目展示)
- [快速开始（评委 / 演示）](#快速开始评委--演示)
- [新机从零部署](#新机从零部署)
- [一键部署（已有 Docker）](#一键部署已有-docker)
- [多 GitHub 账号登录](#多-github-账号登录)
- [环境要求](#环境要求)
- [本地开发](#本地开发)
- [生产部署详解](#生产部署详解)
- [环境变量](#环境变量)
- [项目结构](#项目结构)
- [常用命令](#常用命令)
- [常见问题](#常见问题)

---

## 新机从零部署（Linux）

**前提**：Linux 主机只需 **Git** 与 **Bash**。**不需要**预装 Node、Python、PostgreSQL——全部由 Docker 容器提供。

### 你需要准备什么

| 必须 | 不必 |
|------|------|
| Linux（含 WSL2） | Node.js / npm |
| Git（克隆仓库） | Python |
| Docker（脚本可引导安装） | PostgreSQL / CMake |
| 约 4GB 磁盘 + 网络 | |

### 一键安装

```bash
# 1. 克隆项目
git clone <仓库地址> Reviewly && cd Reviewly

# 2. 一条命令：检查环境 → 自动安装 Docker（若无）→ 静默部署
bash install.sh
```

- 若**没有 Docker**：自动安装 Docker（需 sudo），装完后尽量继续部署；若仍无权限则提示重新登录后再执行 `bash install.sh`。
- 若**已有 Docker**：直接构建并启动，**全程无交互**（使用仓库内 `deploy/.env`，无需手填 OAuth）。
- **首次默认跳过 C++ 引擎**（`PRISM_STUB_ENGINE=1`），避免新机编译失败；功能完整可用，稳定后可在 `deploy/.env` 改 `PRISM_STUB_ENGINE=0` 后 `bash deploy/deploy.sh -y --with-engine` 重新部署。

### 部署成功后

打开 http://localhost:3000 → **系统设置** 配置 AI 模型（API Key 存数据库，不写 `.env`）。

---

## 一键部署（已有 Docker）

Linux 上已安装并启动 Docker 时使用。**无需 Node/npm**（`npm run deploy` 仅为可选入口，同样仅 Linux）。

| 场景 | 命令 |
|------|------|
| **新机（推荐）** | `bash install.sh` |
| **已有 Docker** | `bash deploy/deploy.sh -y` |
| 可选（需 Node） | `npm run deploy` |

**脚本自动完成：**

1. 检查 Docker 是否运行、端口 3000/3001/5432 是否空闲
2. 创建 `deploy/.env`，合并 `services/gateway/.env`，**自动生成** `JWT_SECRET` / `SETTINGS_ENCRYPTION_KEY`
3. 构建镜像并启动：**PostgreSQL → Gateway（含迁移）→ Web**（首次默认 stub，不启 engine）
4. 输出访问地址

加 `-y` 跳过确认；加 `--with-engine` 构建 C++ 引擎：

```bash
bash deploy/deploy.sh -y --with-engine
```

### 卸载

仅删除 **Reviewly / PRism** 创建的 Docker 容器、网络、命名卷与本地 `data/repo-cache`、`logs`、`tmp`。默认**保留** `deploy/.env` 以便重新部署。

| 操作 | 命令 |
|------|------|
| 标准卸载 | `bash deploy/uninstall.sh` |
| 彻底卸载（含配置与依赖） | `bash deploy/uninstall.sh --purge` |
| 可选（需 Node，Linux） | `npm run uninstall` / `npm run uninstall:purge` |

**安全约束：** 不执行 `docker system prune` / `docker volume prune`；不删除非白名单容器、卷或网络。

Purge 模式会在终端二次确认 `[y/N]`，并额外删除 `.env`、`node_modules`、`.next`、Python `.venv` 等。

开发时可在 **系统设置 → Danger Zone** 查看本地资源统计并复制卸载命令。

### 验证

| 用途 | 地址 |
|------|------|
| **前端** | http://localhost:3000 |
| API / 文档 | http://localhost:3001 / http://localhost:3001/docs |
| 健康检查 | http://localhost:3001/health |

```bash
curl http://localhost:3001/health
docker compose -f deploy/docker-compose.yml ps
# stub 模式 3 个业务容器 + postgres；--with-engine 时 4 个
```

### 停止与重启

```bash
# 一键停止全部服务（Docker 栈 + 本地 3000/3001 进程）
bash stop.sh
npm run stop           # Linux，需 Node
```

```bash
docker compose -f deploy/docker-compose.yml down    # 仅停止 Docker，保留数据
bash deploy/deploy.sh -y                            # 再次部署
docker compose -f deploy/docker-compose.yml down -v # 清空数据库卷
```

### GitHub OAuth 登录配置

> **评委 / 克隆即用**：`deploy/.env` 已提交仓库，内含演示用 OAuth，**无需手填**。见文首 [快速开始（评委 / 演示）](#快速开始评委--演示)。

> **自行部署**：若删除了仓库内 `deploy/.env`，可从 `deploy/.env.example` 复制，或运行 `bash deploy/setup-github-oauth.sh`。

**已部署、仅需补配 OAuth：**

```bash
bash deploy/setup-github-oauth.sh
docker compose -f deploy/docker-compose.yml restart gateway
```

**非交互（CI / 脚本）传入：**

```bash
export GITHUB_OAUTH_CLIENT_ID=Ov23li...
export GITHUB_OAUTH_CLIENT_SECRET=...
export PRISM_PUBLIC_URL=http://192.168.1.10:3000   # 可选，用于生成 Callback URL
bash deploy/deploy.sh -y
```

> **普通用户**：若登录页提示「需管理员配置 OAuth」，请联系部署人员完成上述步骤。

**最快试用（不配 GitHub，内网 only）：**

```bash
# 编辑 deploy/.env
PRISM_AUTH_BYPASS=1

# 重启 gateway
docker compose -f deploy/docker-compose.yml restart gateway
```

刷新 http://localhost:3000/login → 点击 **「开发模式进入（无需 GitHub）」**。

**正式 GitHub 登录配置：**

1. 打开 [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**
2. 填写：
   - **Application name**：任意（如 `PRism Local`）
   - **Homepage URL**：`http://localhost:3000`（若用 IP 访问则改为 `http://<你的IP>:3000`）
   - **Authorization callback URL**（必须与 `deploy/.env` 中 `OAUTH_CALLBACK_URL` **完全一致**）：
     ```
     http://localhost:3001/api/auth/github/callback
     ```
     若从其他电脑通过局域网 IP 访问，例如 `http://192.168.1.10:3000`，则 Callback 应设为：
     ```
     http://192.168.1.10:3001/api/auth/github/callback
     ```
     并同步修改 `deploy/.env`：
     ```env
     FRONTEND_URL=http://192.168.1.10:3000
     APP_URL=http://192.168.1.10:3000
     OAUTH_CALLBACK_URL=http://192.168.1.10:3001/api/auth/github/callback
     ```
3. 创建后复制 **Client ID** 与 **Client secret**，写入 `deploy/.env`：
   ```env
   GITHUB_OAUTH_CLIENT_ID=Ov23lixxxxxxxxxxxx
   GITHUB_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. 重启 Gateway：
   ```bash
   docker compose -f deploy/docker-compose.yml restart gateway
   ```

### 多 GitHub 账号登录

浏览器若已登录 GitHub，OAuth 会默认复用当前 **github.com** 会话；仅清除 PRism 本地 JWT **不能**换号。PRism 采用 **双层换号**：先尽量弹出 GitHub 账号选择器（Tier 1），仍回到同一用户时再经 GitHub 退出页重登（Tier 2，**仅**此时使用 `github.com/logout`）。

#### 用户入口（`/login/switch`）

| 按钮 | 行为 |
|------|------|
| 使用当前 GitHub 账号（最快） | 普通 `login()`：纯 `oauth/authorize`，无 `prompt`，复用浏览器已登录账号 |
| 切换账号（推荐） | Tier 1：`prompt=select_account`，可选填写目标 GitHub 用户名作为 `login` hint |
| 无法切换？强制重新登录 | Tier 2：经 `github.com/logout` 后回到 OAuth 授权（跳过自动检测，直接强制） |

已登录用户从右上角 **切换账号** 进入时，等价于 Tier 1（带 `force_reauth`）。

#### 自动同账号检测（Tier 1 → Tier 2）

换号前前端在 `sessionStorage` 记录 `prism_switch_from_github_id`（当前用户的 `githubId`）。OAuth 回调 `/auth/callback` 完成后：

1. 若新 `githubId` **与记录不同** → 换号成功，清理标记并进入首页。
2. 若 **相同** 且尚未做过 Tier 2 → 自动跳转 **一次** `hard_reauth`（logout → authorize）。
3. 若 Tier 2 后仍相同 → `/login?error=same_github_account`，提示使用强制重登或先在 GitHub 退出目标账号。

`prism_hard_reauth_attempted` 用于防止 logout 循环。

#### Gateway API（`/api/auth/github/login`）

| 查询参数 | 说明 |
|----------|------|
| （无） | 默认快速登录 URL |
| `force_reauth=1` | Tier 1：`prompt=select_account` |
| `hard_reauth=1` 或 `github_logout=1` | Tier 2：外层 `github.com/logout?return_to=<encode authorize>`；内层 authorize **不**再带 `hard_reauth` / `prompt` |
| `login` | 可选 GitHub 用户名 hint |
| `return_to` | OAuth 完成后前端路径（写入 `state`） |

> GitHub OAuth App **不支持** `prompt=login`；换号依赖 `select_account` + 条件 logout。

OAuth `state` 携带 `return_path`；Gateway 回调 302 至 `FRONTEND_URL/auth/callback?token=…&next=…`，再由前端写入 JWT 并跳转。

#### 限制与排错

- **Development** 模式 OAuth App：目标用户须在 App allowlist 中（与浏览器是否多账号无关）
- `prompt=select_account` **不保证** 100% 弹出选择器；单 session 时 GitHub 可能仍 instant-auth
- **logout 后停在 GitHub 首页**：在首页对目标账号点 **Sign out**，回到 PRism 登录页点 **「继续 GitHub 授权」**
- OAuth 流程中断：登录页 **「继续 GitHub 授权」**（`prism_oauth_pending`）
- `FRONTEND_URL` / `OAUTH_CALLBACK_URL` 须与浏览器实际访问地址一致（本机 `localhost` vs 局域网 IP）

**内网试用、暂不想配 OAuth**：在 `deploy/.env` 设 `PRISM_AUTH_BYPASS=1` 后重启 gateway（**禁止用于公网生产**）。

### PR 同步与收件箱

纳管仓库的 **开放 PR** 由单一后端入口 `POST /api/repos/sync-prs/managed` 与 GitHub 对齐（前端 `PrSyncProvider` 每 **90 秒**、页面可见时轮询）。同步会 **upsert 开放 PR** 并将 GitHub 上已关闭的 PR 在库中标为 `closed`。

| 概念 | 说明 |
|------|------|
| `openPrCount` | **派生值**：`COUNT(pull_requests WHERE state='open')`，不读 `repositories.open_prs` 缓存列 |
| 收件箱「未查阅」 | **DB 驱动**：`pull_request_user_views`；`last_seen_at` 为空或早于 PR `updated_at` |
| 标记已读 | 打开 PR 评审页时 `POST /api/pull-requests/{id}/seen` |
| 组件禁止自行 sync | 仅全局 `useGlobalPrSync` 调度；列表通过 `pr:sync:updated` 事件刷新 |

**限制：** 本地开发无公网 Webhook 时，新 PR 最多约 90 秒延迟；仓库卡片上的「X 分钟前」为仓库元数据 `lastSyncTime`，不是 PR 列表专用时间戳。

### 可选配置

| 需求 | 操作 |
|------|------|
| GitHub OAuth | 编辑 `deploy/.env` 中的 `GITHUB_OAUTH_*` |
| 启用 C++ 引擎 | `deploy/.env` 设 `PRISM_STUB_ENGINE=0` 后 `bash deploy/deploy.sh -y --with-engine` |
| 仅 Docker 不用脚本 | 见 [生产部署详解](#生产部署详解) |

> **说明**：「一键」= 在 Linux 上执行 `bash install.sh`，由 Docker 拉起服务栈。

---

## 环境要求

| 场景 | 依赖 |
|------|------|
| **Linux 一键部署** | **Git + Linux**（`bash install.sh` 可引导装 Docker） |
| 生产部署（已有 Docker） | Linux + Docker Engine + Compose v2 |
| 本地开发（任意 OS） | Node.js 20+、npm 9+、Python 3.11+ |
| C++ 引擎（可选） | `bash deploy/deploy.sh --with-engine` 或本地 CMake |

---

## 本地开发

### 日常开发（推荐：热重载 + Docker Postgres）

已配置 `deploy/.env` / `services/gateway/.env` 时，用 **本机 Web/Gateway** + **容器 Postgres**，不会重复走 OAuth 向导或全量 Docker 部署：

```bash
npm run dev:local     # Web + Gateway 热重载
npm run dev:db        # 仅启动 Docker Postgres（配合 dev:local）
npm run dev:clean     # 释放 3000/3001 → 确保 Postgres → 重启 dev:local
```

| 地址 | 说明 |
|------|------|
| http://localhost:3000 | Web 前端 |
| http://localhost:3001 | API 网关 |
| http://localhost:3001/health | 健康检查（`migrations` 应为 `ok`） |

`dev:local` 下 Gateway 会**自动选择数据库**（Postgres 或 SQLite 回退），详见 `services/gateway/.env` 中 `PRISM_DATABASE_MODE`。

### Docker 全栈（Linux，Web + Gateway + Postgres 均在容器）

```bash
npm run dev              # Linux：已配置 .env 时快速启动
npm run dev:clean:docker # 释放端口后重启 Docker 全栈
npm run stop             # 停止 Docker 栈
npm run dev -- --Rebuild # 强制重新构建镜像
bash install.sh          # 完整一键部署（首次无 .env 时会初始化配置）
```

`npm run dev` 在环境已就绪时会复用 `deploy/.env` 与已运行的 `prism-postgres`，不再提示「GitHub OAuth 配置」或「按 Enter 开始构建」。

**Gateway 不可达 / `ECONNREFUSED 127.0.0.1:3001`**

Docker 模式：确认容器在跑并查看日志：

```bash
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs gateway
curl http://127.0.0.1:3001/health
```

本地 `dev:local` 模式：Gateway 会自动回退 SQLite；若仍失败，先确认健康检查：

```bash
curl http://127.0.0.1:3001/health
npm run dev:clean
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

## 生产部署详解

`deploy/` 目录包含全栈 Compose 与 Dockerfile，与根目录 `install.sh` / `npm run deploy` 使用同一套配置。

### 脚本内部流程（`deploy/deploy.sh`）

| 步骤 | 动作 |
|------|------|
| 1/7 | 检查 `docker`、`docker compose`、端口 3000/3001/5432 |
| 2/7 | 初始化 `deploy/.env`（必要时合并 `services/gateway/.env`） |
| 3/7 | 构建镜像（`postgres`、`gateway`、`web`；可选 `engine`） |
| 4/7 | 启动 `postgres` |
| 5/7 | 等待 PostgreSQL 健康（`pg_isready`） |
| 6/7 | 启动 `gateway`（及可选 `engine`）；入口脚本执行 `alembic upgrade head` 后启动 Uvicorn |
| 7/7 | 启动 `web`，轮询直至 http://localhost:3000 可访问 |

### 不用一键脚本、手动 Compose

```bash
# 1. 准备环境文件
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env；若有 services/gateway/.env 可手工对照合并

# 2. 构建并启动（在项目根目录）
docker compose -f deploy/docker-compose.yml --env-file deploy/.env build
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
```

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
├── deploy.sh
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
├── deploy/                   # 生产 Docker 全栈（Linux）
│   ├── bootstrap.sh          # 一键引导（装 Docker + 部署）
│   ├── deploy.sh
│   ├── uninstall.sh          # 安全卸载（仅 Reviewly 资源）
│   ├── cleanup.sh            # 卸载共享函数
│   └── install-docker.sh     # Linux Docker 安装助手
├── install.sh                # Linux 一键安装入口
├── stop.sh                   # 停止服务入口
├── docker-compose.yml        # 开发：仅 PostgreSQL
├── docs/                     # 开发者指南、路线图
└── scripts/                  # 开发/部署脚本
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | Docker 全栈（环境已就绪时快速启动） |
| `npm run dev:local` | 本机 Web + Gateway 热重载 |
| `npm run dev:db` | 仅 Docker Postgres |
| `npm run dev:clean` | 清端口 → Postgres → **dev:local** |
| `npm run dev:clean:docker` | 清端口 → **Docker 全栈** |
| `npm run dev:gateway` | 仅 Gateway |
| `npm run dev:engine` | 仅 C++ 引擎 |
| `npm run deploy` | Linux 一键部署（等价于 `bash install.sh`） |
| `npm run stop` | 停止 Docker 栈与本地 3000/3001（Linux） |
| `npm run uninstall` | 卸载 Reviewly 容器/卷/缓存（保留 `.env`，Linux） |
| `npm run uninstall:purge` | 彻底卸载（含配置与 `node_modules`，需确认） |
| `bash deploy/uninstall.sh` | Linux 卸载（同上） |
| `bash install.sh` | **推荐**：引导装 Docker + 部署 |
| `npm run build` | 构建 shared + web |
| `npm run lint` | ESLint + TypeScript 检查 |
| `npm run test` | Gateway pytest |
| `npm run start:app` | 一键启动并打开浏览器 |

---

## 常见问题

| 现象 | 处理 |
|------|------|
| Gateway 3001 启动失败 | Docker：`docker compose -f deploy/docker-compose.yml logs gateway`；本地：`npm run dev:clean` |
| 已配 `.env` 仍进 OAuth 向导 | 检查 `deploy/.env` / `services/gateway/.env` 是否含 `<your-` 占位符；日常开发用 `npm run dev:local` |
| `dockerDesktopLinuxEngine` / Docker 未运行 | 确认 Docker 服务已启动：`sudo systemctl start docker`；开发可用 `npm run dev:local`（SQLite 回退） |
| 本地 dev：`prism` 密码认证失败 / 5432 连不上 | 使用 `npm run dev`（Docker 模式）；或 `dev:local` 会自动回退 SQLite |
| GitHub 登录 404 | `deploy/.env` 中 OAuth 仍是占位符；按 README「GitHub OAuth 登录配置」创建 OAuth App 并填写真实 Client ID/Secret |
| GitHub OAuth 回调失败 | Callback URL 与 GitHub App 设置不一致；检查 IP/端口是否与 `OAUTH_CALLBACK_URL` 相同 |
| PR 列表 / 收件箱不更新 | 见 [PR 同步与收件箱](#pr-同步与收件箱)；确认已登录且 Gateway 正常；等待约 90 秒或切换页签触发同步 |
| 只能登录浏览器当前 GitHub 账号 | [多 GitHub 账号登录](#多-github-账号登录)：`/login/switch` →「切换账号」；仍相同则用「强制重新登录」或等回调自动 Tier 2 |
| 提示「仍登录为同一 GitHub 账号」 | Tier 1/2 均未换号：在 github.com 对当前账号 Sign out，或换浏览器/无痕后再登录；勿无限重试 |
| 换号后停在 GitHub 首页 | logout 的 `return_to` 偶发失效；在 GitHub 首页 Sign out 目标账号后，回 PRism 点「继续 GitHub 授权」 |
| Gateway 容器 `Restarting`，日志 `exec /entrypoint.sh: no such file or directory` | `entrypoint-gateway.sh` 须为 **LF 换行**（Windows CRLF 会导致 Linux 容器无法启动）；拉最新代码后 `docker compose -f deploy/docker-compose.yml build gateway --no-cache && docker compose -f deploy/docker-compose.yml up -d` |
| `gateway is unhealthy` / 连 `127.0.0.1:5432` 失败 | 确认 `deploy/.env` 中 `DATABASE_URL` 为 `@postgres:5432`；拉最新代码后 `docker compose -f deploy/docker-compose.yml build gateway --no-cache && docker compose -f deploy/docker-compose.yml up -d` |
| Docker 部署失败 | 确认 Docker 已运行；`docker compose -f deploy/docker-compose.yml logs gateway` |
| apt：`kali-rolling Release` 没有 Release 文件 | **Kali/Parrot** 等滚动版不能用 Docker 官方 apt 源。`sudo rm /etc/apt/sources.list.d/docker.list` 后执行 `bash install.sh`；`install-docker.sh` 会自动选 `apt_distro`（`docker.io`） |
| Docker 安装方式 | `deploy/install-docker.sh` 按系统智能选择：Kali→系统源、Ubuntu/Debian 稳定版→官方脚本、Fedora/RHEL→dnf 通道、Arch→pacman、openSUSE→zypper |
| Linux `Permission denied` | 执行 `bash deploy/deploy.sh -y` 或 `bash install.sh` |
| Linux `docker: permission denied` | `sudo usermod -aG docker $USER` 后重新登录 |
| 新机无 Docker | `bash install.sh` 自动安装 Docker，或 `bash deploy/install-docker.sh` |
| Engine 镜像构建失败 | 在 `deploy/.env` 设 `PRISM_STUB_ENGINE=1` 后重启 gateway |
| 流式响应卡住 | 确保仅一个 Gateway 实例；长连接走 BFF 路由 |
| Dashboard / 导入 500 | 检查 `/health` 中 `migrations`；执行迁移后重启 Gateway |

---

## 许可证

Private / internal use unless otherwise noted.
