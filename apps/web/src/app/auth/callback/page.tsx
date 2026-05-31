"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { fetchAuthMe } from "@/lib/api/auth"
import { useAuth } from "@/features/prism/contexts/auth-context"
import { clearOAuthPending } from "@/lib/auth/oauth-pending"
import { safeNextPath } from "@/lib/auth/safe-next-path"
import { handleSwitchAccountAfterCallback } from "@/lib/auth/switch-account-flow"
import { syncMyRepositories } from "@/lib/api/repos"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setTokenFromCallback } = useAuth()
  const [message, setMessage] = useState("正在完成登录…")

  useEffect(() => {
    const token = searchParams.get("token")
    if (!token) {
      router.replace("/login?error=missing_token")
      return
    }

    const next = safeNextPath(searchParams.get("next"))

    let cancelled = false
    ;(async () => {
      try {
        clearOAuthPending()
        await setTokenFromCallback(token)
        if (cancelled) return

        const me = await fetchAuthMe()
        const switchResult = await handleSwitchAccountAfterCallback(me)
        if (cancelled) return
        if (switchResult === "redirecting_hard") return
        if (switchResult === "same_account_failed") {
          router.replace("/login?error=same_github_account")
          return
        }

        setMessage("正在同步 GitHub 仓库…")
        try {
          await syncMyRepositories()
        } catch {
          /* sync is best-effort after login */
        }
        if (!cancelled) router.replace(next)
      } catch {
        if (!cancelled) router.replace("/login?error=callback_failed")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams, setTokenFromCallback, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-ai-blue" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          加载中…
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
