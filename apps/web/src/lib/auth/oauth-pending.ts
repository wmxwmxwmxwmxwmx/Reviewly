export const OAUTH_PENDING_KEY = "prism_oauth_pending"

export function markOAuthPending(): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(OAUTH_PENDING_KEY, "1")
  }
}

export function clearOAuthPending(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(OAUTH_PENDING_KEY)
  }
}

export function isOAuthPending(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(OAUTH_PENDING_KEY) === "1"
}
