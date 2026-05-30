/** Server-side proxy to Python gateway (longer timeout than Next dev rewrite). */

const GATEWAY_ORIGIN = process.env.API_URL ?? "http://localhost:3001"
const DEFAULT_TIMEOUT_MS = 120_000

export async function proxyToGateway(
  path: string,
  init: RequestInit,
  options?: { timeoutMs?: number },
): Promise<Response> {
  const normalized = path.startsWith("/") ? path : `/${path}`
  const url = `${GATEWAY_ORIGIN}${normalized}`

  const res = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })

  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  })
}
