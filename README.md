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

## 评委 / 演示一键启动（无需手填 OAuth）

仓库已内置 `deploy/.env` 与 GitHub OAuth，**克隆后无需再输入** `GITHUB_OAUTH_CLIENT_ID` / `SECRET`。

```bash
git clone <仓库地址> Reviewly && cd Reviewly
# Windows: 双击 deploy.bat 或 install.bat（全程无交互）
# Linux:   bash install.sh
# 或:      npm run deploy
```

启动后打开 http://localhost:3000 → **使用 GitHub 登录**。

需换号时：登录页选「使用其他 GitHub 账号登录」，或登录后右上角「切换账号」。详见 [多 GitHub 账号登录](#多-github-账号登录)。

> GitHub OAuth App 的 Callback 须为 `http://localhost:3001/api/auth/github/callback`（已在演示配置中）。**勿将本仓库公开到公网**（含 Client Secret）；正式环境请更换密钥。

---

## 目录

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

## 新机从零部署

**前提**：新机只需 **Git**（拉代码）和 **Bash**（Linux 自带；Windows 用 Git Bash 或 WSL 亦可）。**不需要**预装 Node、Python、PostgreSQL——全部由 Docker 容器提供。

### 你需要准备什么

| 必须 | 不必 |
|------|------|
| Git（克隆仓库） | Node.js / npm |
| Docker（脚本可引导安装） | Python |
| 约 4GB 磁盘 + 网络 | PostgreSQL / CMake |

### Linux 新机（推荐流程）

```bash
# 1. 克隆项目
git clone <仓库地址> Reviewly && cd Reviewly

# 2. 一条命令：检查环境 → 自动安装 Docker（Linux）→ 静默部署
bash install.sh
```

- 若**没有 Docker**（仅 Linux）：自动安装 Docker（需 sudo），装完后尽量继续部署；若仍无权限则提示重新登录后再执行 `bash install.sh`。
- 若**已有 Docker**：直接构建并启动，**全程无交互**（使用仓库内 `deploy/.env`，无需手填 OAuth）。
- **首次默认跳过 C++ 引擎**（`PRISM_STUB_ENGINE=1`），避免新机编译失败；功能完整可用，稳定后可在 `deploy/.env` 改 `PRISM_STUB_ENGINE=0` 重新部署。

等价命令：

```bash
bash install.sh                        # 推荐：一键安装
bash deploy/bootstrap.sh -y --stub-engine
```

### Windows 新机

1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 并启动（或 `winget install Docker.DockerDesktop`）。
2. 克隆仓库后，**双击 `install.bat` 或 `deploy.bat`**（静默部署，无弹窗确认）。

无需安装 Node。须先安装并启动 Docker Desktop。

### macOS 新机

1. 安装并启动 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。
2. 终端执行：

```bash
git clone <仓库地址> Reviewly && cd Reviewly
bash deploy/bootstrap.sh
```

### 部署成功后

打开 http://localhost:3000 → **系统设置** 配置 AI 模型（API Key 存数据库，不写 `.env`）。

---

## 一键部署（已有 Docker）

已安装并启动 Docker 时使用。**无需 Node/npm**（`npm run deploy` 仅为可选入口）。

| 系统 | 命令 |
|------|------|
| **Linux（新机推荐）** | `bash deploy/bootstrap.sh` |
| **Linux / macOS** | `bash deploy/deploy.sh -y` |
| **Windows** | 双击 `deploy.bat` |
| 可选 | `npm run deploy`（需已装 Node） |

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

| 系统 | 标准卸载 | 彻底卸载（含配置与依赖） |
|------|----------|--------------------------|
| Linux / macOS | `bash deploy/uninstall.sh` | `bash deploy/uninstall.sh --purge` |
| Windows (PS 7+) | `.\deploy\uninstall.ps1` | `.\deploy\uninstall.ps1 -Purge` |
| 跨平台（需 Node） | `npm run uninstall` | `npm run uninstall:purge` |

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
./stop.sh              # Linux/macOS
stop.bat               # Windows 双击
npm run stop           # 全平台
```

```bash
docker compose -f deploy/docker-compose.yml down    # 仅停止 Docker，保留数据
bash deploy/deploy.sh -y                            # 再次部署
docker compose -f deploy/docker-compose.yml down -v # 清空数据库卷
```

### GitHub OAuth 登录配置

> **评委 / 克隆即用**：`deploy/.env` 已提交仓库，内含演示用 OAuth，**无需手填**。见文首 [评委 / 演示一键启动](#评委--演示一键启动无需手填-oauth)。

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

浏览器若已登录 GitHub，OAuth 会默认复用当前 session。PRism 提供两种登录方式：

| 方式 | 入口 | 行为 |
|------|------|------|
| 快速登录 | 登录页主按钮「使用 GitHub 登录」 | 复用浏览器已登录 GitHub，一键授权 |
| 其他账号 | 登录页「使用其他 GitHub 账号登录」 | 进入 `/login/switch` 分流页后选择 |
| 切换账号 | 右上角账户菜单 → 切换账号 | 同上 |
| 重新授权 | GitHub 账号对话框 → 重新授权 GitHub | 同上 |

分流页提供「当前 GitHub 账号」（直达 OAuth authorize）与「其他账号」（`github_logout=1` 时经 `github.com/logout` 再授权）。OAuth `state` 携带 `return_path`，回调后进入 `FRONTEND_URL/auth/callback?token=…&next=…` 再跳转项目首页。

**限制与排错：**

- OAuth App 为 **Development** 模式时，目标用户须在 GitHub OAuth App 的 allowlist 中（与会话无关）
- GitHub 退出页请点**单个账号**旁的 Sign out，勿点 **Sign out from all accounts**（易落到 GitHub 首页）
- 若中断在 GitHub 首页，回到 PRism 登录页点「继续 GitHub 授权」
- 确认 `FRONTEND_URL` 与浏览器访问地址一致（如 `http://localhost:3000`）

**内网试用、暂不想配 OAuth**：在 `deploy/.env` 设 `PRISM_AUTH_BYPASS=1` 后重启 gateway（**禁止用于公网生产**）。

### 可选配置

| 需求 | 操作 |
|------|------|
| GitHub OAuth | 编辑 `deploy/.env` 中的 `GITHUB_OAUTH_*` |
| 启用 C++ 引擎 | `deploy/.env` 设 `PRISM_STUB_ENGINE=0` 后 `bash deploy/deploy.sh -y --with-engine` |
| 仅 Docker 不用脚本 | 见 [生产部署详解](#生产部署详解) |

> **说明**：「一键」= 一条 Bash 命令或双击 bat，由 Docker 拉起服务栈；不是单个 `.exe` 安装包。

---

## 环境要求

| 场景 | 依赖 |
|------|------|
| 本地开发 | Node.js 20+、npm 9+、Python 3.11+ |
| **新机 Docker 部署** | **仅 Git + Docker**（`bash deploy/bootstrap.sh` 可引导装 Docker） |
| 生产部署（已有 Docker） | Docker Engine + Compose v2 |
| C++ 引擎（可选） | `deploy/deploy.sh --with-engine` 或本地 CMake |

---

## 本地开发

```bash
# 安装依赖
npm install

# 同时启动 Web (:3000) 与 Gateway (:3001)
npm run dev
```

启动时 Gateway **自动选择数据库**（无需手改 `.env` 即可兼容）：

| 优先级 | 场景 | 行为 |
|--------|------|------|
| 1 | Docker / 本机 Postgres `prism:prism@localhost:5432` 可用 | 使用 PostgreSQL |
| 2 | 5432 未启动但已装 Docker | 自动执行 `docker compose … up -d postgres` 并重试 |
| 3 | 仍不可用（密码不对、无 Docker 等） | 自动回退 **SQLite**（`services/gateway/prism.db`） |
| 可选 | 手动起 Postgres | `npm run dev:db` 后再 `npm run dev` |

在 `services/gateway/.env` 可设 `PRISM_DATABASE_MODE`：`auto`（默认）、`postgres`（仅 PG）、`sqlite`（仅 SQLite）。

| 地址 | 说明 |
|------|------|
| http://localhost:3000 | Web 前端 |
| http://localhost:3001 | API 网关 |
| http://localhost:3001/health | 健康检查（`migrations` 应为 `ok`） |
| http://localhost:3001/docs | OpenAPI 文档 |

**仅启动 Gateway**

```bash
npm run dev:gateway
# 自动探测数据库并执行 alembic upgrade head
```

**仅启动数据库（PostgreSQL，与 deploy 栈一致）**

```bash
npm run dev:db
npm run dev
```

**数据库：PostgreSQL 与 SQLite**

默认 `services/gateway/.env` 使用 `DATABASE_URL=postgresql+psycopg://...@localhost:5432/prism`，需先 `docker compose up -d` 启动 Postgres，否则 `npm run dev` 时 Gateway 迁移会失败、**uvicorn 不会监听 3001**。

无 Docker 时可改为 SQLite（`services/gateway/.env`）：

```env
DATABASE_URL=sqlite:///./prism.db
```

**登录页空白、终端 `ECONNREFUSED 127.0.0.1:3001`**

表示 Gateway 未起来。先确认健康检查：

```bash
curl http://127.0.0.1:3001/health
```

正常应返回 `ok`。修复数据库后重新 `npm run dev`；登录页在 Gateway 不可达时会显示提示与「重试」，而非空白。

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

`deploy/` 目录包含全栈 Compose 与 Dockerfile，与根目录 `deploy.bat` / `npm run deploy` 使用同一套配置。

### 脚本内部流程（`deploy/deploy.ps1` · `deploy/deploy.sh`）

| 步骤 | 动作 |
|------|------|
| 1/7 | 检查 `docker`、`docker compose`、端口 3000/3001/5432 |
| 2/7 | 初始化 `deploy/.env`（必要时合并 `services/gateway/.env`） |
| 3/7 | `docker compose -f deploy/docker-compose.yml build` |
| 4/7 | 启动 `postgres`，等待 `pg_isready` |
| 5/7 | 等待 PostgreSQL 健康 |
| 6/7 | 启动 `gateway`、`engine`；Gateway 入口执行 `alembic upgrade head` 后启动 Uvicorn |
| 7/7 | 启动 `web`，等待 http://localhost:3000 可访问 |

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
│   ├── bootstrap.sh          # 新机引导（装 Docker + 部署）
│   ├── deploy.sh / deploy.ps1
│   ├── uninstall.sh / uninstall.ps1  # 安全卸载（仅 Reviewly 资源）
│   ├── cleanup.sh / cleanup.ps1      # 卸载共享函数
│   └── install-docker.sh     # Linux Docker 安装助手
├── bootstrap.sh              # → deploy/bootstrap.sh
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
| `npm run deploy` | Docker 全栈（需 Node；等价于 deploy 脚本） |
| `npm run stop` | 一键停止 Docker 栈与本地 3000/3001 |
| `npm run uninstall` | 卸载 Reviewly 容器/卷/缓存（保留 `.env`） |
| `npm run uninstall:purge` | 彻底卸载（含配置与 `node_modules`，需确认） |
| `bash deploy/uninstall.sh` | Linux/macOS 卸载（同上） |
| `.\deploy\uninstall.ps1` | Windows 卸载（PowerShell 7+） |
| `bash deploy/bootstrap.sh` | **新机推荐**：引导装 Docker + 部署 |
| `npm run build` | 构建 shared + web |
| `npm run lint` | ESLint + TypeScript 检查 |
| `npm run test` | Gateway pytest |
| `npm run dev:clean` | 释放 3000/3001 端口并重启 |
| `npm run start:app` | 一键启动并打开浏览器 |

---

## 常见问题

| 现象 | 处理 |
|------|------|
| Gateway 3001 启动失败 | `npm run kill:gateway` 或 `npm run dev:clean`；`npm run dev` 会自动探测 DB 并迁移 |
| 本地 dev：`prism` 密码认证失败 / 5432 连不上 | 正常：`npm run dev` 会自动回退 SQLite；要 Postgres 则 `npm run dev:db` 后再启动 |
| GitHub 登录 404 | `deploy/.env` 中 OAuth 仍是占位符；按 README「GitHub OAuth 登录配置」创建 OAuth App 并填写真实 Client ID/Secret |
| GitHub OAuth 回调失败 | Callback URL 与 GitHub App 设置不一致；检查 IP/端口是否与 `OAUTH_CALLBACK_URL` 相同 |
| 只能登录浏览器当前 GitHub 账号 | 见上文 [多 GitHub 账号登录](#多-github-账号登录)：登录页「使用其他 GitHub 账号登录」或右上角「切换账号」 |
| `gateway is unhealthy` / 连 `127.0.0.1:5432` 失败 | 确认 `deploy/.env` 中 `DATABASE_URL` 为 `@postgres:5432`；拉最新代码后 `docker compose -f deploy/docker-compose.yml build gateway --no-cache && docker compose -f deploy/docker-compose.yml up -d` |
| Docker 部署失败 | 确认 Docker 已运行；`docker compose -f deploy/docker-compose.yml logs gateway` |
| apt：`kali-rolling Release` 没有 Release 文件 | **Kali/Parrot** 等滚动版不能用 Docker 官方 apt 源。`sudo rm /etc/apt/sources.list.d/docker.list` 后执行 `bash install.sh`；`install-docker.sh` 会自动选 `apt_distro`（`docker.io`） |
| Docker 安装方式 | `deploy/install-docker.sh` 按系统智能选择：Kali→系统源、Ubuntu/Debian 稳定版→官方脚本、Fedora/RHEL→dnf 通道、Arch→pacman、openSUSE→zypper |
| Linux `Permission denied` | 执行 `bash deploy/deploy.sh` 或 `bash deploy/bootstrap.sh` |
| Linux `docker: permission denied` | `sudo usermod -aG docker $USER` 后重新登录 |
| 新机无 Docker | `bash deploy/bootstrap.sh` 选 y 自动安装，或 `bash deploy/install-docker.sh` |
| Engine 镜像构建失败 | 在 `deploy/.env` 设 `PRISM_STUB_ENGINE=1` 后重启 gateway |
| 流式响应卡住 | 确保仅一个 Gateway 实例；长连接走 BFF 路由 |
| Dashboard / 导入 500 | 检查 `/health` 中 `migrations`；执行迁移后重启 Gateway |

---

## 许可证

Private / internal use unless otherwise noted.
