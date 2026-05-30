import { proxyToGateway, SCAN_TIMEOUT_MS } from "@/lib/server/gateway-proxy"

/** Allow long-running clone + graph build (local dev + Vercel-style limits). */
export const maxDuration = 900

/** BFF: architecture scan clones repos and can exceed Next dev rewrite timeout. */
export async function POST(request: Request) {
  const body = await request.text()
  const authorization = request.headers.get("authorization")

  return proxyToGateway("/api/architecture/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body,
  }, { timeoutMs: SCAN_TIMEOUT_MS })
}
