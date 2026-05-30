import type { ApiError } from "@reviewly/shared"

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
  const token = getAuthToken()
  const res = await fetch(path, {
    ...options,
    headers: buildHeaders(options, token),
  })

  if (!res.ok) {
    const body = await parseFetchJson<ApiError>(res).catch((err) => {
      if (err instanceof PrismApiError) {
        throw err
      }
      return { error: res.statusText } satisfies ApiError
    })
    throw new PrismApiError(
      extractApiErrorMessage(body, res.statusText || "请求失败"),
      res.status,
      typeof body === "object" && body && "code" in body ? String(body.code) : undefined,
    )
  }

  if (res.status === 204) {
    return undefined as T
  }

  return parseFetchJson<T>(res)
}
