import { proxyToGateway } from "@/lib/server/gateway-proxy"
import { serverApiError, serverApiLog, truncateServerLog } from "@/lib/server/debug-api-log"

/** BFF proxy: explicit Next handler for import diagnostics (Route takes precedence over rewrite). */
export async function POST(request: Request) {
  let body = ""
  try {
    body = await request.text()
    const authorization = request.headers.get("authorization")

    serverApiLog("Next Route Handler", {
      "incoming body": truncateServerLog(body),
    })

    return await proxyToGateway(
      "/api/pull-requests/import",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body,
      },
      { debug: true },
    )
  } catch (err) {
    serverApiError("Next Route Handler", err)
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    return new Response(
      JSON.stringify({
        error: "Next Route Handler 代理失败",
        ...(process.env.NODE_ENV === "development"
          ? { exception: message, traceback: stack }
          : {}),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
