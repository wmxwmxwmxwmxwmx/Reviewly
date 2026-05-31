/** Server-side proxy to Python gateway (longer timeout than Next dev rewrite). */

import {
  isServerApiDebugEnabled,
  sanitizeServerHeaders,
  serverApiError,
  serverApiLog,
  truncateServerLog,
} from "@/lib/server/debug-api-log"

const GATEWAY_ORIGIN = process.env.API_URL ?? "http://127.0.0.1:3001"
const DEFAULT_TIMEOUT_MS = 120_000
/** SSE scan streams emit progress for a long time; do not abort while bytes still flow. */
export const SCAN_STREAM_TIMEOUT_MS = null as number | null
/** Legacy cap for non-stream requests (unused by scan SSE). */
const SCAN_TIMEOUT_MS = 900_000

function gatewayUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${GATEWAY_ORIGIN}${normalized}`
}

function gatewayUnreachableMessage(cause: unknown): string {
  if (cause instanceof Error && cause.name === "TimeoutError") {
    return "架构扫描超时：首次克隆大仓库可能较慢。请稍后再次点击「重新扫描」，或刷新页面查看是否已在后台完成。"
  }
  const detail = cause instanceof Error ? cause.message : String(cause)
  if (/ECONNREFUSED|fetch failed|socket hang up|ECONNRESET/i.test(detail)) {
    return "无法连接后端 Gateway（请确认已在 127.0.0.1:3001 运行，且仅启动一个实例）。"
  }
  if (/aborted|timeout|ETIMEDOUT/i.test(detail)) {
    return "架构扫描超时：首次克隆大仓库可能较慢。请稍后再次点击「重新扫描」，或刷新页面查看是否已在后台完成。"
  }
  return `后端请求失败：${detail}`
}

export async function proxyToGateway(
  path: string,
  init: RequestInit,
  options?: { timeoutMs?: number; debug?: boolean },
): Promise<Response> {
  const url = gatewayUrl(path)
  const debug = options?.debug ?? isServerApiDebugEnabled()

  if (debug) {
    serverApiLog("Next Route Handler outgoing request", {
      gatewayUrl: url,
      method: init.method ?? "GET",
      headers: sanitizeServerHeaders(init.headers as Record<string, string> | undefined),
    })
  }

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
  } catch (cause) {
    serverApiError("Next Route Handler gateway fetch", cause)
    const detail =
      cause instanceof Error ? cause.message : String(cause)
    return new Response(
      JSON.stringify({
        error: gatewayUnreachableMessage(cause),
        ...(process.env.NODE_ENV === "development" ? { exception: detail } : {}),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    )
  }

  const body = await res.text()

  if (debug) {
    serverApiLog("Next Route Handler gateway response", {
      status: res.status,
      statusText: res.statusText,
      responseText: truncateServerLog(body),
    })
  }

  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  })
}

/** Stream SSE or other long-lived responses without buffering the full body. */
export async function proxyToGatewayStream(
  path: string,
  init: RequestInit,
  options?: { timeoutMs?: number | null },
): Promise<Response> {
  const url = gatewayUrl(path)
  const timeoutMs = options?.timeoutMs
  const signal =
    init.signal ??
    (timeoutMs === null
      ? undefined
      : AbortSignal.timeout(timeoutMs ?? DEFAULT_TIMEOUT_MS))

  try {
    const res = await fetch(url, {
      ...init,
      signal,
    })

    const contentType = res.headers.get("content-type") ?? "text/event-stream"
    if (!res.ok && !contentType.includes("text/event-stream")) {
      const body = await res.text()
      return new Response(body, {
        status: res.status,
        headers: { "Content-Type": contentType },
      })
    }

    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": res.headers.get("cache-control") ?? "no-cache",
        "X-Accel-Buffering": res.headers.get("x-accel-buffering") ?? "no",
      },
    })
  } catch (cause) {
    return new Response(JSON.stringify({ error: gatewayUnreachableMessage(cause) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export { SCAN_TIMEOUT_MS }
