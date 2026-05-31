/** Sanitize post-OAuth redirect path (relative only). */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  const path = (raw ?? fallback).trim()
  if (!path.startsWith("/") || path.startsWith("//")) {
    return fallback
  }
  if (path.includes("://")) {
    return fallback
  }
  return path
}
