"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Github, Loader2, LogIn } from "lucide-react"
import type { AuthStatusResponse } from "@reviewly/shared"

import { useAuth } from "@/features/prism/contexts/auth-context"
import { fetchAuthStatus } from "@/lib/api/auth"
import { PrismApiError } from "@/lib/api/client"

function OAuthSetupGuide({ status }: { status: AuthStatusResponse }) {
  return (
    <div className="mb-4 rounded-md border border-border bg-card/50 px-3 py-3 text-left text-xs text-muted-foreground">
      <p className="mb-2 font-medium text-foreground">管理员需先配置 GitHub OAuth</p>
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>
          打开{" "}
          <a
            href="https://github.com/settings/developers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ai-blue underline-offset-2 hover:underline"
          >
            GitHub → Developer settings → OAuth Apps
          </a>
          ，新建 OAuth App
        </li>
        <li>
          <span className="text-foreground">Authorization callback URL</span> 填：
          <code className="mt-1 block break-all rounded bg-background px-2 py-1 text-[11px] text-ai-blue">
            {status.oauthCallbackUrl}
          </code>
        </li>
        <li>
          将 Client ID / Secret 写入服务器 <code className="text-foreground">deploy/.env</code>，重启
          Gateway 后刷新本页
        </li>
      </ol>
      <p className="mt-2 text-[11px]">
        内网试用可在 <code className="text-foreground">deploy/.env</code> 设{" "}
        <code className="text-foreground">PRISM_AUTH_BYPASS=1</code> 并重启 gateway，无需 GitHub 登录。
      </p>
    </div>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, loading, login, refreshUser } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const loadStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const status = await fetchAuthStatus()
      setAuthStatus(status)
    } catch {
      setAuthStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

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
    if (authStatus && !authStatus.githubOAuthConfigured) {
      setError("GitHub OAuth 尚未配置，请管理员按下方说明完成配置。")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await login()
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "无法启动 GitHub 登录")
      setSubmitting(false)
    }
  }

  const handleDevEnter = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await refreshUser()
      router.replace("/")
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "开发模式进入失败")
      setSubmitting(false)
    }
  }

  const oauthReady = authStatus?.githubOAuthConfigured ?? false
  const bypassEnabled = authStatus?.authBypassEnabled ?? false

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-panel p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">PRism</h1>
        <p className="mt-1 text-sm text-muted-foreground">企业级代码评审平台</p>
      </div>

      {error && (
        <div className="mb-4 flex gap-2 rounded-md border border-risk-high/30 bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          检查登录配置…
        </div>
      ) : (
        <>
          {bypassEnabled && (
            <button
              type="button"
              onClick={() => void handleDevEnter()}
              disabled={submitting || loading}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-ai-blue/40 bg-ai-blue/10 px-4 py-2.5 text-sm font-medium text-ai-blue transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              开发模式进入（无需 GitHub）
            </button>
          )}

          {oauthReady ? (
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
              使用 GitHub 登录
            </button>
          ) : (
            !bypassEnabled && authStatus && <OAuthSetupGuide status={authStatus} />
          )}

          {!oauthReady && bypassEnabled && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              已启用开发模式；配置 OAuth 后可使用 GitHub 登录
            </p>
          )}
        </>
      )}

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
