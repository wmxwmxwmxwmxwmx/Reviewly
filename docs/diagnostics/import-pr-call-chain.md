# PR Import 调用链诊断报告

本文档说明 AI Review 通过 URL 导入 PR 时的完整请求路径、各层诊断日志位置，以及如何定位 500「服务器内部错误」。

## 调用链总览

```
浏览器 (AI Review Landing / Header)
  ↓ useImportPrByUrl
  ↓ importPullRequestByUrl
  ↓ apiFetch (apps/web/src/lib/api/client.ts)
  ↓ fetch("/api/pull-requests/import")
Next.js dev server (:3000)
  ↓ app/api/pull-requests/import/route.ts  (Route Handler，优先于 rewrite)
  ↓ proxyToGateway → API_URL (默认 http://localhost:3001)
FastAPI Gateway (:3001)
  ↓ main.py middleware (DEBUG 时)
  ↓ data.py import_pull_request
  ↓ import_pr.py import_pull_request_by_url
  ↓ sync.py sync_single_pull_request_public | sync_single_pull_request
  ↓ _persist_pull_request → _map_pr → DB commit
```

> **历史说明**：在引入 BFF Route 之前，import 请求仅经 `next.config.mjs` rewrite 透明代理到 Gateway，Next 终端与 Gateway 均无 import 专用日志，容易误判为「请求未到达 FastAPI」。若响应头含 `server: uvicorn` 且 body 为 `{"error":"服务器内部错误"}`，说明请求**已到达** Gateway，由 `main.py` 全局异常处理器返回。

## 各层日志标记与观察终端

| 层级 | 日志标记 | 观察位置 | 源文件 |
|------|----------|----------|--------|
| Hook | `=== useImportPrByUrl ===` | 浏览器 DevTools Console | `apps/web/src/hooks/use-import-pr-by-url.ts` |
| API 封装 | `=== importPullRequestByUrl ===` | 浏览器 Console | `apps/web/src/lib/api/pull-requests.ts` |
| HTTP 客户端 | `=== apiFetch START ===` / `RESPONSE` | 浏览器 Console | `apps/web/src/lib/api/client.ts` |
| Next BFF | `=== Next Route Handler ===` | **Next.js 终端** (npm run dev) | `apps/web/src/app/api/pull-requests/import/route.ts` |
| Gateway 代理出站 | `=== Next Route Handler outgoing request ===` | Next 终端 | `apps/web/src/lib/server/gateway-proxy.ts` |
| Gateway 代理入站 | `=== Next Route Handler gateway response ===` | Next 终端 | 同上 |
| FastAPI 中间件 | `=== FastAPI === received request` | **Gateway 终端** | `services/gateway/app/main.py` |
| Import 端点 | `=== FastAPI import === parsed url` | Gateway 终端 | `services/gateway/app/api/v1/data.py` |
| 导入逻辑 | `import_pull_request_by_url cache hit` / `github_public ok` | Gateway 终端 | `services/gateway/app/github/import_pr.py` |

### 诊断开关

**Gateway** (`services/gateway/.env`):

```env
DEBUG=true
```

**Web** (`apps/web/.env.local`):

```env
NEXT_PUBLIC_DEBUG_API=1
API_URL=http://localhost:3001
```

说明：

- `/api/pull-requests/import` 在浏览器侧**始终**输出 apiFetch 日志（便于聚焦该 bug）。
- 其他 API 路径需 `NEXT_PUBLIC_DEBUG_API=1` 或 `NODE_ENV=development`。
- Gateway 中间件日志需 `DEBUG=true`。
- `DEBUG=true` 时 import 500 响应可含 `exception` 与 `traceback` 字段。

修改 env 后需**重启 Web 与 Gateway**。

## 故障定位决策树

```
粘贴 URL 导入
│
├─ 浏览器无「apiFetch START」
│   └─ 前端未触发 submit / validateGitHubPrUrl 拦截 / JS 报错
│
├─ 浏览器有 START，Next 终端无「Next Route Handler」
│   └─ Route 未生效：检查 apps/web/src/app/api/pull-requests/import/route.ts 是否存在；
│       或请求未打到 Next（直连 :3001）
│
├─ Next 有 Handler，Gateway 无「FastAPI received request」
│   └─ API_URL 错误 / Gateway 未运行 / 端口冲突
│       检查 Next 日志中 gateway response 是否为 502
│
├─ Gateway 有 received request，返回 500
│   ├─ DEBUG=true 且响应含 traceback → 按栈顶文件:行号定位
│   ├─ DEBUG=false 且 error=「服务器内部错误」→ 开启 DEBUG 重试
│   └─ Gateway 控制台 logger.exception 栈（需 DEBUG + basicConfig）
│
└─ 返回 429/403/404/502 等具体文案
    └─ 业务/ GitHub API 预期错误，非未捕获 500
```

## 500「服务器内部错误」来源

| 位置 | 条件 |
|------|------|
| `services/gateway/app/main.py` `generic_handler` | 未捕获的非 `HTTPException` 异常；`DEBUG=false` 时 `error` 固定为「服务器内部错误」 |
| `services/gateway/app/api/v1/data.py` | `DEBUG=true` 时在 endpoint 内返回带 `traceback` 的 JSON，不经过 generic_handler |

## 历史已知根因（供对照 traceback）

| 异常 | 典型位置 | 根因 |
|------|----------|------|
| `AttributeError: 'NoneType' object has no attribute 'get'` | `sync.py` `_map_pr` | GitHub JSON `"user": null`，`get("user", {})` 仍返回 None |
| 同上 | `sync.py` repo fallback | `"base": null` |
| `httpx.HTTPStatusError` | `github_errors.py` | 502 等未映射状态码（旧版 `raise_for_status()`） |
| `httpx.HTTPStatusError` | `import_pr.py` App 路径 | 未捕获 HTTPError，未回退 public API |

当前代码已对上述问题做加固；若 traceback 指向其他行，以实际栈为准。

## 复现与验证步骤

1. 设置上述 env，重启 `npm run dev` 与 Gateway。
2. 打开 AI Review，粘贴例如 `https://github.com/obra/superpowers/pull/1646`。
3. 依次确认：浏览器 Console → Next 终端 → Gateway 终端 均出现 `=== ... ===` 日志。
4. 若 500：复制响应 JSON 中的 `traceback` 或 Gateway 控制台完整栈。
5. Gateway 回归：`cd services/gateway && pytest tests/test_import_pr.py -q`

## 相关文件索引

- 浏览器：`apps/web/src/lib/debug-api-log.ts`
- 服务端 Next：`apps/web/src/lib/server/debug-api-log.ts`
- BFF Route：`apps/web/src/app/api/pull-requests/import/route.ts`
- Gateway 诊断：`services/gateway/app/core/dev_errors.py`
