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

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAuthToken()
  const res = await fetch(path, {
    ...options,
    headers: buildHeaders(options, token),
  })

  if (!res.ok) {
    let body: ApiError = { error: res.statusText }
    try {
      body = (await res.json()) as ApiError
    } catch {
      /* ignore */
    }
    const message =
      typeof body.error === "string"
        ? body.error
        : (body as { detail?: { error?: string } }).detail?.error ?? "请求失败"
    throw new PrismApiError(message, res.status, body.code)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}
