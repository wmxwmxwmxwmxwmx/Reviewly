"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Github, Loader2 } from "lucide-react"

import { useAuth } from "@/features/prism/contexts/auth-context"
import { PrismApiError } from "@/lib/api/client"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, loading, login } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const oauthError = searchParams.get("error")
    if (oauthError) {
      setError(`GitHub 登录失败：${oauthError}`)
    }
  }, [searchParams])

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/")
    }
  }, [loading, isAuthenticated, router])

  const handleLogin = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await login()
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "无法启动 GitHub 登录")
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-panel p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">PRism</h1>
        <p className="mt-1 text-sm text-muted-foreground">企业级 AI 代码评审平台</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-risk-high/30 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleLogin()}
        disabled={submitting || loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Github className="h-4 w-4" />
        )}
        Continue with GitHub
      </button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        登录后将同步你的 GitHub 仓库并启用 PR 自动分析
      </p>
    </div>
  )
}

export default function LoginPage() {
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
        <LoginContent />
      </Suspense>
    </div>
  )
}
