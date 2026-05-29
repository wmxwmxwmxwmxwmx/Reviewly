"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { SecuritySettings } from "@reviewly/shared"

import { fetchSettings, patchSettings } from "@/lib/api/settings"

import {
  DEFAULT_SECURITY_SETTINGS,
  PIN_STORAGE_KEY,
  hashPin,
  isValidPin,
  normalizeSecuritySettings,
} from "../lib/security-settings"

interface SecuritySettingsContextValue {
  security: SecuritySettings
  hydrated: boolean
  saving: boolean
  saveError: string | null
  isLocked: boolean
  hasTwoFactorPin: boolean
  updateSecurity: (patch: Partial<SecuritySettings>) => void
  saveSecurity: (override?: Partial<SecuritySettings>) => Promise<boolean>
  unlockSession: (pin?: string) => Promise<boolean>
  setTwoFactorPin: (pin: string) => Promise<void>
  clearTwoFactorPin: () => void
  verifyPin: (pin: string) => Promise<boolean>
  lockSession: () => void
}

const SecuritySettingsContext = createContext<SecuritySettingsContextValue | null>(null)

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const
const IDLE_CHECK_INTERVAL_MS = 10_000
const MOUSEMOVE_THROTTLE_MS = 5_000

function readStoredPinHash(): string | null {
  try {
    return window.localStorage.getItem(PIN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function SecuritySettingsProvider({ children }: { children: ReactNode }) {
  const [security, setSecurity] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [pinHash, setPinHash] = useState<string | null>(null)

  const lastActivityRef = useRef(Date.now())
  const lastMouseMoveRef = useRef(0)

  const touchActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (isLocked) return
  }, [isLocked])

  const lockSession = useCallback(() => {
    setIsLocked(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await fetchSettings()
        if (!cancelled) {
          setSecurity(normalizeSecuritySettings(data.security))
        }
      } catch {
        if (!cancelled) {
          setSecurity(DEFAULT_SECURITY_SETTINGS)
        }
      } finally {
        if (!cancelled) {
          setPinHash(readStoredPinHash())
          setHydrated(true)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const onActivity = (event: Event) => {
      if (event.type === "mousemove") {
        const now = Date.now()
        if (now - lastMouseMoveRef.current < MOUSEMOVE_THROTTLE_MS) return
        lastMouseMoveRef.current = now
      }
      touchActivity()
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      const timeoutMs = security.sessionTimeoutMinutes * 60_000
      if (timeoutMs > 0 && Date.now() - lastActivityRef.current >= timeoutMs) {
        lockSession()
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity)
      }
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [hydrated, security.sessionTimeoutMinutes, touchActivity, lockSession])

  useEffect(() => {
    if (!hydrated || isLocked) return

    const timeoutMs = security.sessionTimeoutMinutes * 60_000
    if (timeoutMs <= 0) return

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        lockSession()
      }
    }, IDLE_CHECK_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [hydrated, isLocked, security.sessionTimeoutMinutes, lockSession])

  const updateSecurity = useCallback((patch: Partial<SecuritySettings>) => {
    setSecurity((current) => normalizeSecuritySettings({ ...current, ...patch }))
    setSaveError(null)
  }, [])

  const saveSecurity = useCallback(async (override?: Partial<SecuritySettings>) => {
    const payload = normalizeSecuritySettings({ ...security, ...override })
    setSaving(true)
    setSaveError(null)

    try {
      const data = await patchSettings({ security: payload })
      setSecurity(normalizeSecuritySettings(data.security))
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存安全设置失败"
      setSaveError(message)
      return false
    } finally {
      setSaving(false)
    }
  }, [security])

  const verifyPin = useCallback(
    async (pin: string) => {
      if (!isValidPin(pin) || !pinHash) return false
      const hashed = await hashPin(pin)
      return hashed === pinHash
    },
    [pinHash],
  )

  const setTwoFactorPin = useCallback(async (pin: string) => {
    if (!isValidPin(pin)) {
      throw new Error("PIN 必须为 6 位数字")
    }
    const hashed = await hashPin(pin)
    window.localStorage.setItem(PIN_STORAGE_KEY, hashed)
    setPinHash(hashed)
  }, [])

  const clearTwoFactorPin = useCallback(() => {
    window.localStorage.removeItem(PIN_STORAGE_KEY)
    setPinHash(null)
  }, [])

  const unlockSession = useCallback(
    async (pin?: string) => {
      if (security.twoFactorEnabled && pinHash) {
        if (!pin || !(await verifyPin(pin))) {
          return false
        }
      }

      lastActivityRef.current = Date.now()
      setIsLocked(false)
      return true
    },
    [security.twoFactorEnabled, pinHash, verifyPin],
  )

  const value = useMemo<SecuritySettingsContextValue>(
    () => ({
      security,
      hydrated,
      saving,
      saveError,
      isLocked,
      hasTwoFactorPin: Boolean(pinHash),
      updateSecurity,
      saveSecurity,
      unlockSession,
      setTwoFactorPin,
      clearTwoFactorPin,
      verifyPin,
      lockSession,
    }),
    [
      security,
      hydrated,
      saving,
      saveError,
      isLocked,
      pinHash,
      updateSecurity,
      saveSecurity,
      unlockSession,
      setTwoFactorPin,
      clearTwoFactorPin,
      verifyPin,
      lockSession,
    ],
  )

  return <SecuritySettingsContext.Provider value={value}>{children}</SecuritySettingsContext.Provider>
}

export function useSecuritySettings() {
  const context = useContext(SecuritySettingsContext)

  if (!context) {
    throw new Error("useSecuritySettings must be used within SecuritySettingsProvider")
  }

  return context
}
