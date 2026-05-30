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
export function formatPrismApiError(error: unknown, fallback = "请求失败"): string {
  if (error instanceof PrismApiError) {
    if (error.code === "SCHEMA_OUTDATED") {
      return SCHEMA_OUTDATED_HINT
    }
    return error.message || fallback
  }
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}

export function extractApiErrorMessage(
  data: unknown,
  fallback = "请求失败",
): string {
  if (!data || typeof data !== "object") {
    return fallback
  }
  const body = data as Record<string, unknown>
  if (typeof body.error === "string") {
    return body.error
  }
  const detail = body.detail
  if (detail && typeof detail === "object") {
    const nested = (detail as Record<string, unknown>).error
    if (typeof nested === "string") {
      return nested
    }
  }
  if (typeof detail === "string") {
    return detail
  }
  return fallback
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
        typeof body === "object" && body && "code" in body ? String(body.code) : undefined,
      )
      if (debug && !silentStatuses?.includes(apiErr.status)) {
        debugApiError("apiFetch", apiErr)
      }
      throw apiErr
    } catch (err) {
      if (debug && !(err instanceof PrismApiError)) {
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
