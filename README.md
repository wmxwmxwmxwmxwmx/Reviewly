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

Optional: `npm run dev:engine` (C++ gRPC engine, stub by default), `docker compose up -d` (PostgreSQL only).

## 生产一键部署（Docker）

> **说明**：PRism 包含 PostgreSQL、Python、Next.js、C++ 四个运行时，**无法**打包成单个 `.exe` 内嵌全部依赖。最接近「一个可执行入口」的方式是：先安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，然后**双击或一条命令**触发部署脚本（脚本负责构建镜像并启动容器）。

### 最简单的方式（推荐）

| 平台 | 操作 |
|------|------|
| **Windows** | 双击仓库根目录的 **`deploy.bat`**（或 `deploy.cmd`） |
| **任意平台** | 在项目根目录执行 **`npm run deploy`** |
| Linux / macOS | `./deploy.sh`（首次 `chmod +x deploy.sh`） |

脚本会自动检查 Docker、生成/合并 `deploy/.env`、构建镜像并启动：PostgreSQL → Gateway + Engine → Web。

### 访问地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| API | http://localhost:3001 |
| API 文档 | http://localhost:3001/docs |

### 环境要求

- Docker Desktop 已安装且**正在运行**
- 端口 **3000 / 3001 / 5432** 未被占用
- 首次部署会下载镜像并构建，耗时约 10–30 分钟（视网络与 CPU 而定）

环境变量模板：`deploy/.env.example`。首次运行会从 `services/gateway/.env` 合并已有配置（AI Key、OAuth 等）。详见 `deploy/` 目录。

### 常用命令

```bash
docker compose -f deploy/docker-compose.yml ps      # 状态
docker compose -f deploy/docker-compose.yml logs -f # 日志
docker compose -f deploy/docker-compose.yml down    # 停止
```

根目录 `docker-compose.yml` 仅用于开发时启动 PostgreSQL；**完整生产栈**请使用 `deploy/docker-compose.yml`。

## Environment variables

### Gateway (`services/gateway/.env`)

Copy from `services/gateway/.env.example`.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL or SQLite (`sqlite:///./prism.db`) |
| `GITHUB_PAT` | GitHub API token — higher rate limits for import/sync |
| `SETTINGS_ENCRYPTION_KEY` | Encrypts AI keys in DB (`openssl rand -hex 32`) |
| `JWT_SECRET`, `GITHUB_OAUTH_*` | OAuth login (optional in dev with `PRISM_AUTH_BYPASS=1`) |

**AI provider keys** are stored **encrypted in the database** via **Settings → AI** in the UI. They are **not** set as `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` env vars.

### Web (`apps/web/.env`)

Copy from `apps/web/.env.example`.

| Variable | Purpose |
|----------|---------|
| `API_URL` | BFF proxy target (default `http://127.0.0.1:3001`) |
| `NEXT_PUBLIC_DEBUG_API` | `1` to log API traffic in dev |
| `NEXT_PUBLIC_PRISM_AUTH_BYPASS` | `1` for local UI without OAuth |

## FAQ

| Issue | What to do |
|-------|------------|
| **Port 3001 fails to start** | `npm run kill:gateway` or `npm run dev:clean`. Run `cd services/gateway && alembic upgrade head`. |
| **GitHub rate limit** | Set `GITHUB_PAT` in gateway `.env` or sign in with GitHub OAuth. |
| **Docker deploy fails** | Ensure Docker Desktop is running. Check `docker compose -f deploy/docker-compose.yml logs gateway`. |
| **Engine image build fails** | Set `PRISM_STUB_ENGINE=1` in `deploy/.env` and restart gateway. |
| **Streaming hangs** | Single Gateway on `:3001`; use BFF routes for SSE. |

## Project layout

```
Reviewly/
├── apps/web/              # Next.js frontend
├── services/gateway/      # FastAPI API
├── services/engine/       # C++ analysis (optional)
├── packages/shared/       # Shared TypeScript types
├── packages/contracts/    # OpenAPI + protobuf
├── deploy/                # Production Docker stack
├── deploy.bat / deploy.cmd / deploy.sh   # One-click deploy entrypoints
├── docker-compose.yml     # Dev: PostgreSQL only
└── scripts/
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Web + Gateway |
| `npm run deploy` | **Production**: Docker full stack (same as `deploy.bat`) |
| `npm run dev:gateway` | Gateway only |
| `npm run build` | Build shared + web |
| `npm run test` | Gateway pytest |
| `npm run dev:clean` | Kill ports 3000/3001 and restart |

## License

Private / internal use unless otherwise noted.
