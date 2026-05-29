# PRism 后端：自动化能力 vs 人工配置

## 一、无需人工即可运行的能力（代码已实现）

在默认环境变量下（`PRISM_STUB_ENGINE=1`，SQLite 或 Postgres 已配置），Gateway 已提供：

| 能力 | 说明 |
|------|------|
| B2 持久化 | PR / Diff / AnalysisJob / Findings 落库；空库自动 seed |
| B3 GitHub | 无凭据时跳过真实 API；有凭据时可 `POST /api/repos/sync`、webhook |
| B4 分析 | Python 引擎（chunking / rules / scoring）；`POST .../analysis` 生成 `result_summary` |
| B5–B9 领域 API | Security / Performance / Governance / Team / Architecture 的 CRUD 与 stats |
| B10 设置 | `PATCH /api/settings`（含 `ai.apiKey` 加密写入）、`test-integration`、`rotate-secret` |
| 前端 | Governance / Team / Performance / Security View 调用对应 `/api/*` |

**本地启动（自动化路径）：**

```powershell
# 仓库根目录
npm run dev:gateway
# 或全栈
npm run dev
```

Gateway 默认 `http://localhost:3001`。验证：

- `GET http://localhost:3001/health` → `ok`
- `GET http://localhost:3001/api/pull-requests` → 有 PR 列表
- `POST http://localhost:3001/api/pull-requests/{id}/analysis` → 完成后 `GET .../analysis/latest` 含评分摘要

测试（无需外部服务）：

```powershell
cd services/gateway
.\.venv\Scripts\pytest tests/ -q
```

---

## 二、仅人工配置（按顺序执行）

### 1. 数据库

**做什么：** 生产或团队环境使用 PostgreSQL；本地可继续 SQLite。

**命令：**

```powershell
cd services/gateway
copy .env.example .env
# 编辑 .env：DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/prism
.\.venv\Scripts\alembic upgrade head
```

**成功标准：** `alembic current` 显示最新 revision；`GET /api/pull-requests` 不报错。

Docker Postgres（可选）：

```powershell
docker compose up -d postgres   # 若仓库提供 compose
```

---

### 2. 设置加密密钥（保存 API Key 时必需）

**做什么：** 为 `secrets` 字段配置 Fernet 密钥。

**命令：** 在 `services/gateway/.env` 增加：

```env
SETTINGS_ENCRYPTION_KEY=<32 字节 url-safe base64，可用 python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
```

**成功标准：** `PATCH /api/settings` 传入 `{"ai":{"apiKey":"sk-..."}}` 后，再次 `GET /api/settings` 中 `ai.apiKey` 为脱敏值（非明文），且 `POST /api/settings/test-integration` 在 key 有效时返回 `ok: true`。

---

### 3. GitHub App（真实仓库同步与 Webhook）

**做什么：** 在 GitHub 创建 App，配置权限与 Webhook，将凭据写入 Gateway。

**步骤：**

1. GitHub → Settings → Developer settings → GitHub Apps → New
2. 权限：Repository（Contents、Pull requests、Metadata 等按 `docs/plan.md`）
3. 生成并下载 **Private Key**（`.pem`）
4. 记录 **App ID**、**Webhook secret**
5. 在 `services/gateway/.env` 配置（名称以 `.env.example` 为准）：
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY`（PEM 内容或路径）
   - `GITHUB_WEBHOOK_SECRET`
6. 本地暴露 webhook（示例 ngrok）：
   ```powershell
   ngrok http 3001
   ```
   将 `https://xxx.ngrok.io/api/webhooks/github` 填入 App Webhook URL
7. 安装 App 到组织/仓库后：
   ```http
   POST http://localhost:3001/api/repos/sync
   ```

**成功标准：** `GET /api/repos` 出现真实仓库；新 PR webhook 能触发同步（日志可见）。

---

### 4. LLM 提供方（可选，增强分析）

**做什么：** 配置 OpenAI / Anthropic 等，用于分析 pipeline 的可选 LLM 补充与 `POST /api/ai/chat`。

**方式：**

- API：`PATCH /api/settings`，body 含 `ai.provider`、`ai.apiKey`（或 `secrets` 结构，见 OpenAPI）
- 或 PRism UI 设置页（前端 `localStorage` 与后端 secrets 分离，分析 pipeline 读 **后端** secrets）

**成功标准：** `POST /api/settings/test-integration` 返回成功；分析 job 日志无 “skipped LLM” 类错误（无 key 时静默跳过属正常）。

---

### 5. C++ gRPC 引擎（可选，非默认）

**做什么：** 用 C++ 引擎替代 Python stub（`PRISM_STUB_ENGINE=0`）。

**命令（示例，需本机 CMake / 编译链）：**

```powershell
cd services/engine
cmake -B build -DPRISM_USE_GRPC=ON
cmake --build build
# .env
PRISM_STUB_ENGINE=0
ENGINE_GRPC_ADDR=localhost:50051
```

**成功标准：** `RunAnalysis` 经 gRPC 返回 findings；Gateway 健康检查 engine 为 grpc。

---

### 6. 生产检查清单

- [ ] `SETTINGS_ENCRYPTION_KEY` 由密钥管理服务注入，不进仓库
- [ ] `DATABASE_URL` 使用托管 Postgres，定期备份
- [ ] GitHub webhook 使用 HTTPS 与强 secret
- [ ] 日志与 APM **禁止** 打印 API Key / PEM
- [ ] 定期 `POST /api/settings/rotate-secret`（密钥轮换策略）

---

## 三、相关文档

- 总体规划：[`docs/plan.md`](plan.md)
- API 契约：[`packages/contracts/openapi/prism-v1.yaml`](../packages/contracts/openapi/prism-v1.yaml)
