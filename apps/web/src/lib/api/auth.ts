import type { AuthLoginResponse, AuthStatusResponse, AuthUser, GithubAccountInfo } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchAuthStatus(options?: { signal?: AbortSignal; noRetry?: boolean }) {
  return apiFetch<AuthStatusResponse>("/api/auth/status", options ?? {})
}

export function fetchGithubLoginUrl(options?: {
  forceReauth?: boolean
  hardReauth?: boolean
  githubLogout?: boolean
  login?: string
  prompt?: "select_account"
  returnTo?: string
  signal?: AbortSignal
}) {
  const qs = new URLSearchParams()
  if (options?.forceReauth) qs.set("force_reauth", "1")
  if (options?.hardReauth) qs.set("hard_reauth", "1")
  if (options?.githubLogout) qs.set("github_logout", "1")
  if (options?.login?.trim()) qs.set("login", options.login.trim())
  if (options?.prompt) qs.set("prompt", options.prompt)
  if (options?.returnTo?.trim()) qs.set("return_to", options.returnTo.trim())
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
