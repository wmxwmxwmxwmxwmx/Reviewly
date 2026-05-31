import { proxyToGateway, proxyToGatewayStream } from "@/lib/server/gateway-proxy"

/** BFF proxy: dev rewrites time out on long LLM calls; this route allows up to 120s. */
export async function POST(request: Request) {
  const body = await request.text()
  const authorization = request.headers.get("authorization")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(authorization ? { Authorization: authorization } : {}),
  }

  let stream = false
  try {
    const parsed = JSON.parse(body) as { stream?: boolean }
    stream = Boolean(parsed.stream)
  } catch {
    /* invalid JSON — Gateway returns 400 */
  }

  const init = { method: "POST" as const, headers, body }

  if (stream) {
    return proxyToGatewayStream("/api/ai/chat", init, {
      incomingSignal: request.signal,
    })
  }

  return proxyToGateway("/api/ai/chat", init, {
    incomingSignal: request.signal,
  })
}
