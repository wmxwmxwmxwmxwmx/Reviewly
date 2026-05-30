"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { KeyRound, Lock, Shield } from "lucide-react"

import { useSecuritySettings } from "@/features/prism/contexts/security-settings-context"
import { cn } from "@/lib/utils"

export function SessionLockOverlay() {
  const { security, isLocked, unlockSession, hasTwoFactorPin } = useSecuritySettings()
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  if (!isLocked) return null

  const requiresPin = security.twoFactorEnabled && hasTwoFactorPin

  const handleUnlock = async () => {
    setUnlocking(true)
    setError(null)

    const ok = await unlockSession(requiresPin ? pin : undefined)
    if (!ok) {
      setError(requiresPin ? "验证码错误，请重试" : "解锁失败，请重试")
      setUnlocking(false)
      return
    }

    setPin("")
    setError(null)
    setUnlocking(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md mx-4 rounded-lg border border-border bg-panel p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ai-blue/10 border border-ai-blue/30">
            {requiresPin ? (
              <Shield className="h-5 w-5 text-ai-blue" />
            ) : (
              <Lock className="h-5 w-5 text-ai-blue" />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">会话已锁定</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {requiresPin
                ? "因长时间无操作，请输入 PIN 解锁会话以继续"
                : "因长时间无操作，请确认后继续工作"}
            </p>
          </div>
        </div>

        {requiresPin && (
          <label className="block space-y-2 mb-4">
            <span className="text-xs font-medium text-muted-foreground">6 位验证码</span>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                  setError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleUnlock()
                }}
                placeholder="输入 6 位 PIN"
                className="w-full h-10 rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground tracking-widest outline-none transition-colors placeholder:text-muted-foreground focus:border-ai-blue focus:ring-2 focus:ring-ai-blue/20"
                autoFocus
              />
            </div>
          </label>
        )}

        {error && <p className="mb-3 text-xs text-risk-high">{error}</p>}

        <button
          type="button"
          onClick={() => void handleUnlock()}
          disabled={unlocking || (requiresPin && pin.length !== 6)}
          className={cn(
            "w-full h-10 rounded-md text-sm font-medium text-white bg-ai-blue transition-colors",
            "hover:bg-sky-300 disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {unlocking ? "验证中…" : requiresPin ? "验证并继续" : "继续工作"}
        </button>
      </motion.div>
    </div>
  )
}
