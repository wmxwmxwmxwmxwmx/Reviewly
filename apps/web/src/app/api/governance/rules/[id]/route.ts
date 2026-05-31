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
    })
  } catch (err) {
    serverApiError("governance rule GET", err)
    throw err
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
    })
  } catch (err) {
    serverApiError("governance rule PATCH", err)
    throw err
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  try {
    return await proxyToGateway(`/api/governance/rules/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: forwardGatewayHeaders(_request, { contentType: null }),
    })
  } catch (err) {
    serverApiError("governance rule DELETE", err)
    throw err
  }
}
