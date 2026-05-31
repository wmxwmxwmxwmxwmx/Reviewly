import { forwardGatewayHeaders } from "@/lib/server/forward-gateway-headers"
import { proxyToGateway } from "@/lib/server/gateway-proxy"
import { serverApiError } from "@/lib/server/debug-api-log"

type RouteContext = { params: Promise<{ id: string }> }

/** BFF proxy for single governance rule. */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  try {
    return await proxyToGateway(`/api/governance/rules/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: forwardGatewayHeaders(request, { contentType: null }),
    }, { incomingSignal: request.signal })
  } catch (err) {
    serverApiError("governance rule GET", err)
    const detail = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({
        error: "治理规则读取代理失败，请确认 Gateway 已在 127.0.0.1:3001 运行",
        ...(process.env.NODE_ENV === "development" ? { exception: detail } : {}),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  try {
    const body = await request.text()
    return await proxyToGateway(`/api/governance/rules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: forwardGatewayHeaders(request),
      body,
    }, { incomingSignal: request.signal })
  } catch (err) {
    serverApiError("governance rule PATCH", err)
    const detail = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({
        error: "治理规则更新代理失败，请确认 Gateway 已在 127.0.0.1:3001 运行",
        ...(process.env.NODE_ENV === "development" ? { exception: detail } : {}),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params
  try {
    return await proxyToGateway(`/api/governance/rules/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: forwardGatewayHeaders(request, { contentType: null }),
    }, { incomingSignal: request.signal })
  } catch (err) {
    serverApiError("governance rule DELETE", err)
    const detail = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({
        error: "治理规则删除代理失败，请确认 Gateway 已在 127.0.0.1:3001 运行",
        ...(process.env.NODE_ENV === "development" ? { exception: detail } : {}),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )
  }
}
