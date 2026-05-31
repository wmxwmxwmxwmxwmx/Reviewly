/** Forward auth (and optional content-type) to the Python gateway. */
export function forwardGatewayHeaders(
  request: Request,
  options?: { contentType?: string | null },
): Record<string, string> {
  const headers: Record<string, string> = {}
  const contentType = options?.contentType
  if (contentType !== null) {
    headers["Content-Type"] = contentType ?? "application/json"
  }
  const authorization = request.headers.get("authorization")
  if (authorization) {
    headers.Authorization = authorization
  }
  return headers
}
