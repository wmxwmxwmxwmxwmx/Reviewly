import type { AuthLoginResponse, AuthStatusResponse, AuthUser, GithubAccountInfo } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchAuthStatus(signal?: AbortSignal) {
  return apiFetch<AuthStatusResponse>("/api/auth/status", { signal })
}

export function fetchGithubLoginUrl(options?: {
  forceReauth?: boolean
  login?: string
  signal?: AbortSignal
}) {
  const qs = new URLSearchParams()
  if (options?.forceReauth) qs.set("force_reauth", "1")
  if (options?.login?.trim()) qs.set("login", options.login.trim())
  const suffix = qs.size ? `?${qs.toString()}` : ""
  return apiFetch<AuthLoginResponse>(`/api/auth/github/login${suffix}`, {
    signal: options?.signal,
  })
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
