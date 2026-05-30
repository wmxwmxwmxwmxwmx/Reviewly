import type { AuthLoginResponse, AuthUser, GithubAccountInfo } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchGithubLoginUrl() {
  return apiFetch<AuthLoginResponse>("/api/auth/github/login")
}

export function fetchAuthMe(signal?: AbortSignal) {
  return apiFetch<AuthUser>("/api/auth/me", { signal })
}

export function fetchGithubAccount(signal?: AbortSignal) {
  return apiFetch<GithubAccountInfo>("/api/auth/github/account", { signal })
}

export function logoutAuth() {
  return apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" })
}
