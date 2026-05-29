"use client"

import { useEffect, useState } from "react"
import { Shield } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type TwoFactorPinDialogMode = "setup" | "disable"

type TwoFactorPinDialogProps = {
  open: boolean
  mode: TwoFactorPinDialogMode
  onOpenChange: (open: boolean) => void
  onConfirm: (pin: string) => Promise<void> | void
}

export function TwoFactorPinDialog({
  open,
  mode,
  onOpenChange,
  onConfirm,
}: TwoFactorPinDialogProps) {
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setPin("")
      setConfirmPin("")
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const isSetup = mode === "setup"

  const handleSubmit = async () => {
    if (!/^\d{6}$/.test(pin)) {
      setError("请输入 6 位数字验证码")
      return
    }

    if (isSetup && pin !== confirmPin) {
      setError("两次输入的验证码不一致")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onConfirm(pin)
      onOpenChange(false)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "操作失败，请重试"
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-panel border-border" showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-ai-blue" />
            {isSetup ? "设置双因素认证" : "关闭双因素认证"}
          </DialogTitle>
          <DialogDescription>
            {isSetup
              ? "请设置 6 位 PIN 作为本地验证码。会话锁定后将需要输入此码解锁。"
              : "请输入当前 PIN 以确认关闭双因素认证。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              {isSetup ? "新 PIN" : "当前 PIN"}
            </span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                setError(null)
              }}
              className="w-full h-10 rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground tracking-widest outline-none transition-colors focus:border-ai-blue focus:ring-2 focus:ring-ai-blue/20"
              autoFocus
            />
          </label>

          {isSetup && (
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">确认 PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(event) => {
                  setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                  setError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSubmit()
                }}
                className="w-full h-10 rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground tracking-widest outline-none transition-colors focus:border-ai-blue focus:ring-2 focus:ring-ai-blue/20"
              />
            </label>
          )}

          {error && <p className="text-xs text-risk-high">{error}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-9 rounded-md border border-border px-4 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || pin.length !== 6 || (isSetup && confirmPin.length !== 6)}
            className={cn(
              "h-9 rounded-md px-4 text-sm font-medium text-white bg-ai-blue hover:bg-sky-300",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {submitting ? "处理中…" : isSetup ? "启用" : "确认关闭"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
