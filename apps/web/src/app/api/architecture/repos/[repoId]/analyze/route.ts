import { proxyToGatewayStream } from "@/lib/server/gateway-proxy"

/** BFF: stream architecture AI analysis (SSE) with extended timeout. */
export async function POST(
  request: Request,
  context: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await context.params
  const body = await request.text()
  const authorization = request.headers.get("authorization")

  return proxyToGatewayStream(`/api/architecture/repos/${repoId}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body,
  }, { incomingSignal: request.signal })
}
