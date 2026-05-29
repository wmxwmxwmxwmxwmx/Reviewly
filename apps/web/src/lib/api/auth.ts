import type { AuthLoginResponse, AuthUser } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchGithubLoginUrl() {
  return apiFetch<AuthLoginResponse>("/api/auth/github/login")
}

export function fetchAuthMe(signal?: AbortSignal) {
  return apiFetch<AuthUser>("/api/auth/me", { signal })
}

export function logoutAuth() {
  return apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" })
}
