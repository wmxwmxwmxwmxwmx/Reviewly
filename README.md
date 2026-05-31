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

Copy from `apps/web/.env.example`.

| Variable | Purpose |
|----------|---------|
| `API_URL` | BFF proxy target (default `http://127.0.0.1:3001`) |
| `NEXT_PUBLIC_DEBUG_API` | `1` to log API traffic in dev |
| `NEXT_PUBLIC_PRISM_AUTH_BYPASS` | `1` for local UI without OAuth |

## FAQ

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
├── apps/web/              # Next.js frontend
├── services/gateway/      # FastAPI API
├── services/engine/       # C++ analysis (optional)
├── packages/shared/       # Shared TypeScript types
├── packages/contracts/    # OpenAPI + protobuf
├── docs/                  # Developer guide, plan
└── scripts/               # Dev scripts (PowerShell)
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
