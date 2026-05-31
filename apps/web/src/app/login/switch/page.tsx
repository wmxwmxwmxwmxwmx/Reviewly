"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Github, Loader2 } from "lucide-react"

import { useAuth } from "@/features/prism/contexts/auth-context"
import { PrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"

function SwitchAccountContent() {
  const router = useRouter()
  const { login, startOtherAccountOAuth } = useAuth()
  const [loginHint, setLoginHint] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem("prism_login_hint")
    if (stored) {
      setLoginHint(stored)
      sessionStorage.removeItem("prism_login_hint")
    }
  }, [])

  const handleCurrentAccount = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await login("/")
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "无法启动 GitHub 登录")
      setSubmitting(false)
    }
  }

  const handleOtherAccount = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await startOtherAccountOAuth(loginHint.trim() || undefined)
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "无法启动 GitHub 登录")
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-panel p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">{zh.login.switch.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{zh.login.switch.description}</p>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-risk-high/30 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void handleCurrentAccount()}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Github className="h-4 w-4" />
          )}
          {zh.login.switch.currentAccount}
        </button>

        <input
          type="text"
          value={loginHint}
          onChange={(e) => setLoginHint(e.target.value)}
          placeholder={zh.login.usernameHint}
          disabled={submitting}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ai-blue disabled:opacity-50"
          autoComplete="username"
        />

        <button
          type="button"
          onClick={() => void handleOtherAccount()}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-foreground transition-opacity hover:bg-surface-3 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Github className="h-4 w-4" />
          )}
          {zh.login.switch.otherAccount}
        </button>

        <p className="text-center text-[11px] text-muted-foreground">{zh.login.switch.otherAccountHint}</p>

        <button
          type="button"
          onClick={() => router.back()}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {zh.login.switch.cancel}
        </button>
      </div>
    </div>
  )
}

export default function LoginSwitchPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中…
          </div>
        }
      >
        <SwitchAccountContent />
      </Suspense>
    </div>
  )
}
