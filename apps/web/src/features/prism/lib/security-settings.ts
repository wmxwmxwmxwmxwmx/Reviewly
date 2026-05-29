import type { SecuritySettings, SessionTimeoutMinutes } from "@reviewly/shared"

export const PIN_STORAGE_KEY = "prism.2fa-pin-hash"

export const SESSION_TIMEOUT_OPTIONS: { value: SessionTimeoutMinutes; label: string }[] = [
  { value: 15, label: "15 分钟" },
  { value: 30, label: "30 分钟" },
  { value: 60, label: "1 小时" },
  { value: 120, label: "2 小时" },
  { value: 0, label: "永不" },
]

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  twoFactorEnabled: false,
  sessionTimeoutMinutes: 30,
}

const VALID_TIMEOUTS = new Set<SessionTimeoutMinutes>(SESSION_TIMEOUT_OPTIONS.map((o) => o.value))

export function formatSessionTimeout(minutes: SessionTimeoutMinutes): string {
  return SESSION_TIMEOUT_OPTIONS.find((o) => o.value === minutes)?.label ?? "30 分钟"
}

export function normalizeSecuritySettings(value: unknown): SecuritySettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SECURITY_SETTINGS
  }

  const candidate = value as Partial<SecuritySettings>
  const timeout = Number(candidate.sessionTimeoutMinutes)

  return {
    twoFactorEnabled: Boolean(candidate.twoFactorEnabled),
    sessionTimeoutMinutes: VALID_TIMEOUTS.has(timeout as SessionTimeoutMinutes)
      ? (timeout as SessionTimeoutMinutes)
      : DEFAULT_SECURITY_SETTINGS.sessionTimeoutMinutes,
  }
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin)
}
