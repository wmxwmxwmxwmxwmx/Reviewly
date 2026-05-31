import { forwardGatewayHeaders } from "@/lib/server/forward-gateway-headers"
import { proxyToGateway } from "@/lib/server/gateway-proxy"
import { serverApiError } from "@/lib/server/debug-api-log"

/** BFF proxy: stable governance CRUD (Route Handler takes precedence over rewrite). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    return await proxyToGateway(`/api/governance/rules${url.search}`, {
      method: "GET",
      headers: forwardGatewayHeaders(request, { contentType: null }),
    })
  } catch (err) {
    serverApiError("governance rules GET", err)
    throw err
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    return await proxyToGateway("/api/governance/rules", {
      method: "POST",
      headers: forwardGatewayHeaders(request),
      body,
    })
  } catch (err) {
    serverApiError("governance rules POST", err)
    throw err
  }
}
