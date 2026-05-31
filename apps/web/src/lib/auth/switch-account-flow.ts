import type { AuthUser } from "@reviewly/shared"

import { fetchGithubLoginUrl } from "@/lib/api/auth"

export const SWITCH_FROM_GITHUB_ID_KEY = "prism_switch_from_github_id"
export const HARD_REAUTH_ATTEMPTED_KEY = "prism_hard_reauth_attempted"
export const SWITCH_LOGIN_HINT_KEY = "prism_login_hint"

export function beginSwitchAccountFlow(fromGithubId: string | null, loginHint?: string) {
  if (typeof window === "undefined") return
  if (fromGithubId) {
    sessionStorage.setItem(SWITCH_FROM_GITHUB_ID_KEY, fromGithubId)
  } else {
    sessionStorage.removeItem(SWITCH_FROM_GITHUB_ID_KEY)
  }
  sessionStorage.removeItem(HARD_REAUTH_ATTEMPTED_KEY)
  const hint = loginHint?.trim()
  if (hint) {
    sessionStorage.setItem(SWITCH_LOGIN_HINT_KEY, hint)
  } else {
    sessionStorage.removeItem(SWITCH_LOGIN_HINT_KEY)
  }
}

export function markHardReauthAttempted() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(HARD_REAUTH_ATTEMPTED_KEY, "1")
  }
}

export function isHardReauthAttempted(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(HARD_REAUTH_ATTEMPTED_KEY) === "1"
}

export function clearSwitchAccountFlowKeys() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(SWITCH_FROM_GITHUB_ID_KEY)
  sessionStorage.removeItem(HARD_REAUTH_ATTEMPTED_KEY)
  sessionStorage.removeItem(SWITCH_LOGIN_HINT_KEY)
}

export function getSwitchLoginHint(): string | undefined {
  if (typeof window === "undefined") return undefined
  const hint = sessionStorage.getItem(SWITCH_LOGIN_HINT_KEY)?.trim()
  return hint || undefined
}

export type SwitchAccountCallbackResult =
  | "continue"
  | "redirecting_hard"
  | "same_account_failed"

/**
 * After OAuth callback: if switch intent matched same GitHub user, auto Tier-2 once.
 */
export async function handleSwitchAccountAfterCallback(
  me: AuthUser,
): Promise<SwitchAccountCallbackResult> {
  if (typeof window === "undefined") return "continue"

  const fromId = sessionStorage.getItem(SWITCH_FROM_GITHUB_ID_KEY)
  if (!fromId) {
    clearSwitchAccountFlowKeys()
    return "continue"
  }

  if (me.githubId !== fromId) {
    clearSwitchAccountFlowKeys()
    return "continue"
  }

  if (isHardReauthAttempted()) {
    clearSwitchAccountFlowKeys()
    return "same_account_failed"
  }

  markHardReauthAttempted()
  const { url } = await fetchGithubLoginUrl({
    hardReauth: true,
    login: getSwitchLoginHint(),
    returnTo: "/",
  })
  window.location.href = url
  return "redirecting_hard"
}
