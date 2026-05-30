/** Server-side API diagnostics (Next.js Route Handlers / gateway proxy). */

import { isAbortError } from "@/lib/abort-utils"

const MAX_LOG_TEXT = 4096

export function isServerApiDebugEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEBUG_API === "1" ||
    process.env.NODE_ENV === "development"
  )
}

export function truncateServerLog(value: string, max = MAX_LOG_TEXT): string {
  if (value.length <= max) {
    return value
  }
  return `${value.slice(0, max)}… [truncated ${value.length - max} chars]`
}

export function sanitizeServerHeaders(
  headers: Record<string, string> | HeadersInit | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) {
    return out
  }
  const h = headers instanceof Headers ? headers : new Headers(headers)
  h.forEach((value, key) => {
    if (key.toLowerCase() === "authorization") {
      out[key] = value.startsWith("Bearer ") ? "Bearer ***" : "***"
    } else {
      out[key] = value
    }
  })
  return out
}

export function serverApiLog(section: string, payload: Record<string, unknown>): void {
  if (!isServerApiDebugEnabled()) {
    return
  }
  console.log(`=== ${section} ===`)
  for (const [key, value] of Object.entries(payload)) {
    console.log(`  ${key}:`, value)
  }
}

export function serverApiError(section: string, err: unknown): void {
  if (!isServerApiDebugEnabled() || isAbortError(err)) {
    return
  }
  console.error(`=== ${section} ERROR ===`)
  if (err instanceof Error) {
    console.error("  message:", err.message)
    console.error("  stack:", err.stack)
    console.error(err)
    return
  }
  console.error(err)
}
