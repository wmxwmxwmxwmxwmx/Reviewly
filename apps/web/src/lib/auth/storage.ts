const TOKEN_KEY = "prism_auth_token"

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function clearAuthSession(): void {
  clearAuthToken()
  if (typeof window !== "undefined") {
    sessionStorage.clear()
  }
}

export function isAuthBypassEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PRISM_AUTH_BYPASS === "1"
}
