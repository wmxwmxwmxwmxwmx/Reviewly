import { proxyToGateway } from "@/lib/server/gateway-proxy"

/** BFF proxy: dev rewrites time out on long LLM calls; this route allows up to 120s. */
export async function POST(request: Request) {
  const body = await request.text()
  const authorization = request.headers.get("authorization")

  return proxyToGateway("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body,
  })
}
