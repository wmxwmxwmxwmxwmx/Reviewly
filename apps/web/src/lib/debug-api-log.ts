/** Dev-only structured API diagnostics (browser + shared helpers). */

import { isAbortError } from "@/lib/abort-utils"

const MAX_LOG_TEXT = 4096

export function isApiDebugEnabled(path?: string): boolean {
  if (path === "/api/pull-requests/import") {
    return true
  }
  if (process.env.NEXT_PUBLIC_DEBUG_API === "1") {
    return true
  }
  return process.env.NODE_ENV === "development"
}

export function truncateForLog(value: string, max = MAX_LOG_TEXT): string {
  if (value.length <= max) {
    return value
  }
  return `${value.slice(0, max)}… [truncated ${value.length - max} chars]`
}

export function sanitizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) {
    return out
  }
  const h = new Headers(headers)
  h.forEach((value, key) => {
    if (key.toLowerCase() === "authorization") {
      out[key] = value.startsWith("Bearer ") ? "Bearer ***" : "***"
    } else {
      out[key] = value
    }
  })
  return out
}

export function debugApiLog(section: string, payload: Record<string, unknown>): void {
  if (typeof console === "undefined" || typeof console.groupCollapsed !== "function") {
    return
  }
  console.groupCollapsed(`=== ${section} ===`)
  for (const [key, value] of Object.entries(payload)) {
    console.log(`${key}:`, value)
  }
  console.groupEnd()
}

export function debugApiError(section: string, err: unknown): void {
  if (typeof console === "undefined" || isAbortError(err)) {
    return
  }
  console.error(`=== ${section} ERROR ===`)
  if (err instanceof Error) {
    console.error("message:", err.message)
    console.error("stack:", err.stack)
    console.error(err)
    return
  }
  console.error(err)
}
