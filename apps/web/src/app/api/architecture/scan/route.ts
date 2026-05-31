import { proxyToGatewayStream, SCAN_STREAM_TIMEOUT_MS } from "@/lib/server/gateway-proxy"

/** Large monorepos: allow up to 1h for clone + scan in serverless/dev. */
export const maxDuration = 3600

/** BFF: architecture scan clones repos and can exceed Next dev rewrite timeout. */
export async function POST(request: Request) {
  const body = await request.text()
  const authorization = request.headers.get("authorization")

  return proxyToGatewayStream(
    "/api/architecture/scan",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body,
    },
    { timeoutMs: SCAN_STREAM_TIMEOUT_MS, incomingSignal: request.signal },
  )
}
