import type { ApiError } from "@reviewly/shared"

import {
  debugApiError,
  debugApiLog,
  isApiDebugEnabled,
  sanitizeHeaders,
  truncateForLog,
} from "@/lib/debug-api-log"
import { getAuthToken } from "@/lib/auth/storage"

export class PrismApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message)
    this.name = "PrismApiError"
  }
}

type RequestOptions = RequestInit & {
  signal?: AbortSignal
  /** Caller handles these HTTP statuses; skip debug error logging. */
  silentStatuses?: number[]
  /** Skip retry loop (e.g. analysis job polling). */
  noRetry?: boolean
}

function buildHeaders(options: RequestOptions, token: string | null): HeadersInit {
  const base: Record<string, string> = { "Content-Type": "application/json" }
  const existing = new Headers(options.headers ?? undefined)
  if (token && !existing.has("Authorization")) {
    base.Authorization = `Bearer ${token}`
  }
  existing.forEach((value, key) => {
    base[key] = value
  })
  return base
}

/** Parse fetch body as JSON; surface plain-text 5xx (e.g. "Internal Server Error") clearly. */
export async function parseFetchJson<T = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  const text = await response.text()
  if (!text.trim()) {
    return {} as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    if (!response.ok) {
      throw new PrismApiError(
        text.length > 280 ? `${text.slice(0, 280)}…` : text,
        response.status,
      )
    }
    throw new PrismApiError("响应不是有效的 JSON", response.status)
  }
}

const SCHEMA_OUTDATED_HINT =
  "数据库 schema 未更新。请在 services/gateway 目录执行 alembic upgrade head 后重启 Gateway。"

/** Map API errors to user-facing analysis messages. */
const GATEWAY_UNREACHABLE_HINT =
  "无法连接后端 Gateway（请确认已在 127.0.0.1:3001 运行，且仅启动一个实例；可执行 npm run dev:clean 后重试）"

export function formatPrismApiError(error: unknown, fallback = "请求失败"): string {
  if (error instanceof PrismApiError) {
    if (/^internal server error$/i.test(error.message.trim())) {
      return GATEWAY_UNREACHABLE_HINT
    }
    if (error.code === "SCHEMA_OUTDATED") {
      return SCHEMA_OUTDATED_HINT
    }
    if (error.code === "DATABASE_UNAVAILABLE") {
      return `${error.message}（请确认仅有一个 Gateway 在 localhost:3001 运行）`
    }
    if (error.code === "GATEWAY_STARTING") {
      return error.message || "Gateway 正在启动，请稍候再试"
    }
    if (error.code === "GOVERNANCE_ERROR") {
      return error.message || "治理规则操作失败，请稍后重试"
    }
    if (error.code === "GOVERNANCE_PAYLOAD_INVALID") {
      return error.message || "治理规则数据异常，请编辑该规则后重新保存"
    }
    return error.message || fallback
  }
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}

function _errorPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") {
    return null
  }
  const body = data as Record<string, unknown>
  if (typeof body.error === "string" || typeof body.code === "string") {
    return body
  }
  const detail = body.detail
  if (detail && typeof detail === "object") {
    return detail as Record<string, unknown>
  }
  return null
}

export function extractApiErrorCode(data: unknown): string | undefined {
  const payload = _errorPayload(data)
  if (!payload) {
    return undefined
  }
  const code = payload.code
  return typeof code === "string" ? code : undefined
}

export function extractApiErrorMessage(
  data: unknown,
  fallback = "请求失败",
): string {
  const payload = _errorPayload(data)
  if (payload && typeof payload.error === "string") {
    const base = payload.error
    if (
      process.env.NODE_ENV === "development" &&
      typeof payload.exception === "string" &&
      payload.exception.length > 0
    ) {
      return `${base}（${payload.exception}）`
    }
    return base
  }
  if (!data || typeof data !== "object") {
    return fallback
  }
  const body = data as Record<string, unknown>
  if (typeof body.detail === "string") {
    return body.detail
  }
  return fallback
}

const API_ERROR_TITLES: Record<string, string> = {
  GITHUB_RATE_LIMIT: "GitHub 调用频率受限",
  GITHUB_AUTH_FAILED: "GitHub 认证失败",
  GITHUB_FORBIDDEN: "无法访问仓库",
  PR_NOT_FOUND: "未找到 PR",
  INVALID_PR_URL: "PR 链接无效",
  SCHEMA_OUTDATED: "数据库需要迁移",
}

export function formatImportErrorMessage(error: unknown, fallback = "导入失败"): string {
  if (error instanceof PrismApiError) {
    const title = error.code ? API_ERROR_TITLES[error.code] : undefined
    if (title && error.message) {
      return `${title}：${error.message}`
    }
    return formatPrismApiError(error, fallback)
  }
  return formatPrismApiError(error, fallback)
}

const API_FETCH_MAX_ATTEMPTS = 4
const API_FETCH_RETRY_BASE_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableApiError(
  error: unknown,
  path: string,
  method: string,
): boolean {
  if (error instanceof PrismApiError) {
    if (error.code === "GATEWAY_STARTING") return true
    if (error.status === 502 || error.status === 503 || error.status === 504) return true
    // Gateway --reload 或双实例竞态时可能短暂返回 500
    if (
      error.status === 500 &&
      (method === "POST" || method === "PATCH" || method === "DELETE") &&
      path.includes("/governance/")
    ) {
      return true
    }
  }
  return error instanceof TypeError
}

async function apiFetchOnce<T>(
  path: string,
  options: RequestOptions = {},
  logErrors = true,
): Promise<T> {
  const { silentStatuses, ...fetchOptions } = options
  const token = getAuthToken()
  const method = fetchOptions.method ?? "GET"
  const headers = buildHeaders(options, token)
  const debug = isApiDebugEnabled(path)

  if (debug) {
    debugApiLog("apiFetch START", {
      path,
      method,
      headers: sanitizeHeaders(headers),
      body: typeof fetchOptions.body === "string" ? truncateForLog(fetchOptions.body) : fetchOptions.body,
    })
  }

  let res: Response
  try {
    res = await fetch(path, {
      ...fetchOptions,
      headers,
    })
  } catch (err) {
    if (debug) {
      debugApiError("apiFetch", err)
    }
    throw err
  }

  const responseClone = debug ? res.clone() : null
  if (debug && responseClone) {
    const responseText = truncateForLog(await responseClone.text())
    debugApiLog("apiFetch RESPONSE", {
      status: res.status,
      statusText: res.statusText,
      responseText,
    })
  }

  if (!res.ok) {
    try {
      const body = await parseFetchJson<ApiError>(res).catch((err) => {
        if (err instanceof PrismApiError) {
          throw err
        }
        return { error: res.statusText } satisfies ApiError
      })
      const apiErr = new PrismApiError(
        extractApiErrorMessage(body, res.statusText || "请求失败"),
        res.status,
        extractApiErrorCode(body),
      )
      if (logErrors && debug && !silentStatuses?.includes(apiErr.status)) {
        debugApiError("apiFetch", apiErr)
      }
      throw apiErr
    } catch (err) {
      if (logErrors && debug && !(err instanceof PrismApiError)) {
        debugApiError("apiFetch", err)
      }
      throw err
    }
  }

  if (res.status === 204) {
    return undefined as T
  }

  try {
    return await parseFetchJson<T>(res)
  } catch (err) {
    if (debug) {
      debugApiError("apiFetch", err)
    }
    throw err
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.noRetry) {
    return apiFetchOnce<T>(path, options)
  }

  const method = options.method ?? "GET"
  let lastError: unknown
  for (let attempt = 1; attempt <= API_FETCH_MAX_ATTEMPTS; attempt++) {
    const logErrors = attempt >= API_FETCH_MAX_ATTEMPTS
    try {
      return await apiFetchOnce<T>(path, options, logErrors)
    } catch (err) {
      lastError = err
      if (!isRetryableApiError(err, path, method) || attempt >= API_FETCH_MAX_ATTEMPTS) {
        throw err
      }
      await sleep(API_FETCH_RETRY_BASE_MS * attempt)
    }
  }
  throw lastError
}
