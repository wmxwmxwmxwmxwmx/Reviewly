# Reviewly

**Reviewly** is an AI Pull Request review platform (PRism UI). The stack uses a **Next.js BFF + FastAPI Gateway** architecture: the browser talks only to Next.js; all GitHub, AI, and sync logic runs on the Gateway.

## Architecture

```
Browser
  ↓
Next.js (:3000) — BFF / UI only
  ↓
FastAPI Gateway (:3001)
  ↓
GitHub API + LLM APIs
```

- **Next.js** proxies `/api/*` to the Gateway (rewrites + a few BFF routes for long timeouts and SSE).
- **Gateway** owns repositories, PRs, analysis, governance, webhooks, and encrypted AI settings.
- **Do not** call GitHub or LLM providers directly from the browser.

For deeper docs see [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md).

## Quick start

```bash
npm install

# Web (:3000) + Gateway (:3001)
npm run dev

# Gateway only
npm run dev:gateway
```

| URL | Service |
|-----|---------|
| http://localhost:3000 | Web UI |
| http://localhost:3001 | API Gateway |
| http://localhost:3001/health | Health check |

Optional: `npm run dev:engine` (C++ gRPC engine, stub by default), `docker compose up -d` (PostgreSQL).

## Environment variables

### Gateway (`services/gateway/.env`)

Copy from `services/gateway/.env.example`.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL or SQLite (`sqlite:///./prism.db`) |
| `GITHUB_PAT` | GitHub API token (not `GITHUB_TOKEN`) — higher rate limits for import/sync |
| `SETTINGS_ENCRYPTION_KEY` | Encrypts AI keys stored in DB (`openssl rand -hex 32`) |
| `JWT_SECRET`, `GITHUB_OAUTH_*` | OAuth login (optional in dev with `PRISM_AUTH_BYPASS=1`) |

**AI provider keys** are stored **encrypted in the database** via **Settings → AI** in the UI. They are **not** set as `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variables.

### Web (`apps/web/.env`)

<<<<<<< HEAD
### PostgreSQL（B2+，仅数据库）
=======
Copy from `apps/web/.env.example`.
>>>>>>> 6575adc591d7d38c215705deb2c9922aa5da87c1

| Variable | Purpose |
|----------|---------|
| `API_URL` | BFF proxy target (default `http://127.0.0.1:3001`) |
| `NEXT_PUBLIC_DEBUG_API` | `1` to log API traffic in dev |
| `NEXT_PUBLIC_PRISM_AUTH_BYPASS` | `1` for local UI without OAuth |

<<<<<<< HEAD
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
=======
## FAQ
>>>>>>> 6575adc591d7d38c215705deb2c9922aa5da87c1

| Issue | What to do |
|-------|------------|
| **Port 3001 fails to start** | Another uvicorn may be running: `npm run kill:gateway` or `npm run dev:clean`. Run migrations: `cd services/gateway && alembic upgrade head`. |
| **GitHub rate limit** | Set `GITHUB_PAT` in gateway `.env` or sign in with GitHub OAuth (~5000/h vs ~60/h unauthenticated). |
| **Streaming hangs** | Ensure a single Gateway instance on `:3001`. Use BFF routes (`/api/ai/chat`, architecture scan). Closing the tab aborts upstream via `AbortSignal` in `gateway-proxy.ts`. |
| **CLOSE_WAIT (Windows)** | Leftover connections from uvicorn `--reload`. Mitigated by `scripts/kill-port.ps1` and `npm run dev:clean` before restart. |

## Architecture rules

1. **Next.js** — UI + BFF only; `route.ts` handlers proxy to Gateway, no business logic.
2. **Gateway** — All AI, GitHub, sync, and persistence.
3. **No** direct browser → GitHub or browser → LLM.

## Project layout

```
Reviewly/
<<<<<<< HEAD
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
=======
├── apps/web/              # Next.js frontend
├── services/gateway/      # FastAPI API
├── services/engine/       # C++ analysis (optional)
├── packages/shared/       # Shared TypeScript types
├── packages/contracts/    # OpenAPI + protobuf
├── docs/                  # Developer guide, plan
└── scripts/               # Dev scripts (PowerShell)
>>>>>>> 6575adc591d7d38c215705deb2c9922aa5da87c1
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Web + Gateway |
| `npm run dev:gateway` | Gateway only |
| `npm run build` | Build shared + web |
| `npm run lint` | ESLint + typecheck |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Gateway pytest |
| `npm run clean` | Remove build artifacts |
| `npm run dev:clean` | Kill ports 3000/3001 and restart |

## License

Private / internal use unless otherwise noted.
