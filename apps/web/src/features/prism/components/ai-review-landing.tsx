"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowRight, Github, Loader2 } from "lucide-react"

import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { ExternalRepoOnboardDialog } from "@/features/prism/components/external-repo-onboard-dialog"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { useImportPrByUrl } from "@/hooks/use-import-pr-by-url"
import { useRunningTask } from "@/features/prism/contexts/running-tasks-context"
import { validateGitHubPrUrl } from "@/lib/github-pr-url"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

const URL_AUTO_SUBMIT_MS = 600

export function AiReviewLanding() {
  const { navigate } = useNavigation()
  const [inputUrl, setInputUrl] = useState("")
  const [focused, setFocused] = useState(false)
  const [localUrlError, setLocalUrlError] = useState<string | null>(null)
  const { refresh: refreshRepos } = useReposStore()
  const {
    importing,
    importError,
    handleImportUrl,
    pendingOnboardRepoId,
    clearPendingOnboard,
  } = useImportPrByUrl()

  useRunningTask("aiReview", importing)

  const submitUrl = useCallback(async () => {
    const trimmed = inputUrl.trim()
    if (!trimmed || importing) return
    const validationError = validateGitHubPrUrl(trimmed)
    if (validationError) {
      setLocalUrlError(validationError)
      return
    }
    setLocalUrlError(null)
    await handleImportUrl(trimmed)
  }, [handleImportUrl, importing, inputUrl])

  useEffect(() => {
    const trimmed = inputUrl.trim()
    if (!trimmed || importing) return
    if (validateGitHubPrUrl(trimmed)) return

    const timer = window.setTimeout(() => {
      void submitUrl()
    }, URL_AUTO_SUBMIT_MS)

    return () => window.clearTimeout(timer)
  }, [inputUrl, importing, submitUrl])

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-5">
      <ExternalRepoOnboardDialog
        repoId={pendingOnboardRepoId}
        open={Boolean(pendingOnboardRepoId)}
        onOpenChange={(open) => {
          if (!open) clearPendingOnboard()
        }}
        onOnboarded={() => void refreshRepos()}
      />
      <div className="text-center max-w-md">
        <h1 className="text-lg font-semibold text-foreground">{zh.nav.aiReview}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.aiReview}</p>
        <p className="text-sm text-muted-foreground mt-3">{zh.common.aiReviewEmptyHint}</p>
      </div>

      <div className="w-full max-w-lg space-y-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium px-0.5">
          {zh.common.importPrUrl}
        </span>
        <div
          className={cn(
            "relative flex items-center gap-2 h-10 px-3 rounded-md border bg-surface-2 transition-all duration-200",
            focused
              ? "border-ai-blue shadow-[0_0_0_2px_rgba(56,189,248,0.15)]"
              : "border-border hover:border-border-strong",
            (importError || localUrlError) && "border-risk-high/50",
          )}
        >
          <Github className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value)
              if (localUrlError) setLocalUrlError(null)
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void submitUrl()
              }
            }}
            disabled={importing}
            placeholder={zh.common.importPrPlaceholder}
            aria-label={zh.common.importPrUrl}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0 font-mono text-xs disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void submitUrl()}
            disabled={importing || !inputUrl.trim()}
            className="shrink-0 p-0.5 rounded hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
            aria-label={importing ? zh.common.importingPr : zh.common.loadPr}
          >
            {importing ? (
              <Loader2 className="w-3.5 h-3.5 text-ai-blue animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5 text-ai-blue" />
            )}
          </button>
        </div>
        {(localUrlError || importError) && (
          <p className="text-[11px] text-risk-high leading-snug px-0.5">
            {localUrlError ?? importError}
          </p>
        )}
        {importing && (
          <p className="text-[11px] text-muted-foreground px-0.5">{zh.common.importingPrHint}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate("pull-requests")}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
      >
        或前往 PR 列表选择
      </button>
    </main>
  )
}
