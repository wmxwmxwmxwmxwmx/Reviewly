/** Server-side proxy to Python gateway (longer timeout than Next dev rewrite). */

const GATEWAY_ORIGIN = process.env.API_URL ?? "http://localhost:3001"
const DEFAULT_TIMEOUT_MS = 120_000
const SCAN_TIMEOUT_MS = 300_000

function gatewayUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${GATEWAY_ORIGIN}${normalized}`
}

function gatewayUnreachableMessage(cause: unknown): string {
  const detail = cause instanceof Error ? cause.message : String(cause)
  if (/ECONNREFUSED|fetch failed|socket hang up|ECONNRESET/i.test(detail)) {
    return "无法连接后端 Gateway（请确认已在 localhost:3001 运行，且仅启动一个实例）。"
  }
  return `后端请求失败：${detail}`
}

export async function proxyToGateway(
  path: string,
  init: RequestInit,
  options?: { timeoutMs?: number },
): Promise<Response> {
  const url = gatewayUrl(path)

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
  } catch (cause) {
    return new Response(JSON.stringify({ error: gatewayUnreachableMessage(cause) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    })
  }

  const body = await res.text()
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
  options?: { timeoutMs?: number },
): Promise<Response> {
  const url = gatewayUrl(path)

  try {
    const res = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
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
