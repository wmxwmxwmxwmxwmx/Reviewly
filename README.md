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

拉取含数据库变更的代码后，若 Dashboard 或 PR URL 导入返回「服务器内部错误」，请先执行：

```bash
cd services/gateway
python scripts/repair_migration_drift.py   # 修复 alembic 版本与 schema 漂移（可选）
alembic upgrade head
```

然后重启 Gateway，并确认 `GET http://localhost:3001/health` 中 `migrations` 为 `ok`。

### C++ 引擎（可选）

```bash
npm run dev:engine
# 详见 services/engine/README.md
```

开发默认 `PRISM_STUB_ENGINE=1`，无需启动 C++ 进程。

### PostgreSQL（B2+，仅数据库）

```bash
docker compose up -d
cd services/gateway
alembic upgrade head
```

## 生产一键部署（Docker）

`deploy/` 目录提供全栈生产部署：PostgreSQL + Gateway + Web + C++ 引擎，**一条命令**启动。

### 环境要求

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)（或 Docker Engine + Compose v2）
- 本机端口未被占用：**3000**（Web）、**3001**（Gateway）、**5432**（PostgreSQL）
- Linux/macOS 额外需要 `curl`（健康检查）

### 一键启动

**Linux / macOS：**

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

**Windows（PowerShell）：**

```powershell
.\deploy\deploy.ps1
```

脚本会自动：

1. 检查 Docker 与端口占用
2. 若不存在 `deploy/.env`，从 `deploy/.env.example` 创建，并**合并** `services/gateway/.env` 中已配置的变量（如 AI Key、OAuth 等，不会写入模板文件）
3. 构建镜像并按顺序启动：PostgreSQL → Gateway + Engine → Web

### 访问地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| API 网关 | http://localhost:3001 |
| API 文档 | http://localhost:3001/docs |
| 健康检查 | http://localhost:3001/health |

### 环境变量

复制并编辑模板（首次运行脚本会自动处理）：

```bash
cp deploy/.env.example deploy/.env
```

关键变量说明：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 容器内使用 `postgresql+psycopg://prism:prism@postgres:5432/prism` |
| `API_URL` | Web 构建时 `/api` 反向代理目标，默认 `http://gateway:3001` |
| `ENGINE_GRPC_ADDR` | C++ 引擎地址，默认 `engine:50051` |
| `PRISM_STUB_ENGINE` | `0` 使用 C++ 引擎；`1` 使用 Python stub（无需 engine 容器） |
| `JWT_SECRET` / `SETTINGS_ENCRYPTION_KEY` | 使用 `openssl rand -hex 32` 生成 |
| `PRISM_REPO_CACHE_DIR` | 架构扫描 git 缓存，默认 `/data/repo-cache`（与 engine 共享卷） |

敏感信息请勿提交到 Git；`deploy/.env` 已加入 `.gitignore`。

### 常用运维命令

```bash
# 查看服务状态
docker compose -f deploy/docker-compose.yml ps

# 查看日志
docker compose -f deploy/docker-compose.yml logs -f

# 仅查看 Gateway
docker compose -f deploy/docker-compose.yml logs -f gateway

# 停止并移除容器（保留数据卷）
docker compose -f deploy/docker-compose.yml down

# 停止并删除数据卷（清空数据库与缓存）
docker compose -f deploy/docker-compose.yml down -v
```

### 部署目录结构

```
deploy/
├── .env.example          # 环境变量模板
├── docker-compose.yml    # 全栈 Compose（postgres / gateway / web / engine）
├── Dockerfile.gateway    # Python Gateway 镜像
├── Dockerfile.web        # Next.js 多阶段构建
├── Dockerfile.engine     # C++ gRPC 引擎（PRISM_USE_GRPC=ON）
├── entrypoint-gateway.sh # 启动前执行 alembic upgrade head
├── deploy.sh             # Linux/macOS 一键脚本
├── deploy.ps1            # Windows 一键脚本
└── Caddyfile             # 可选 HTTPS 反代（默认注释）
```

### 验证部署

```bash
curl http://localhost:3001/health   # migrations 应为 ok
curl -I http://localhost:3000/      # 应返回 200
docker compose -f deploy/docker-compose.yml ps   # 四个服务均为 running
```

### HTTPS（可选）

编辑 `deploy/Caddyfile`，取消注释并填写域名后，可在 `docker-compose.yml` 中增加 Caddy 服务作为反向代理（将 `/api/*` 转发到 gateway，其余转发到 web）。

### 故障排查

| 现象 | 处理建议 |
|------|----------|
| 端口被占用 | 修改 `deploy/docker-compose.yml` 端口映射，或停止占用进程 |
| Gateway 启动失败 | `docker compose -f deploy/docker-compose.yml logs gateway`，检查 `DATABASE_URL` 与迁移 |
| Engine 镜像构建失败 | 临时设置 `PRISM_STUB_ENGINE=1` 后重启 gateway；或参考 `services/engine/README.md` 本地构建 |
| Web 无法访问 API | 确认构建参数 `API_URL=http://gateway:3001`，且 gateway 容器健康 |
| 私有仓库克隆失败 | 在 `deploy/.env` 配置 `GIT_CREDENTIALS` 或挂载 Git 凭证 |

开发与生产区别：根目录 `docker-compose.yml` **仅启动 PostgreSQL**；完整应用栈请使用 `deploy/docker-compose.yml`。

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
├── docker-compose.yml        # 开发用：仅 PostgreSQL
├── deploy/                   # 生产一键部署（全栈 Docker）
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
