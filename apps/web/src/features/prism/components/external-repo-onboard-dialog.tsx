"use client"

import { useCallback, useMemo } from "react"
import { Loader2, GitPullRequest } from "lucide-react"

import type { Repository } from "@reviewly/shared"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RepositoryOnboardingProgress } from "@/features/prism/components/repository-onboarding-progress"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { useRepositoryOnboarding } from "@/hooks/use-repository-onboarding"
import { adoptDismissKey } from "@/lib/repository-onboarding"
import { zh } from "@/lib/i18n/zh"

interface ExternalRepoOnboardDialogProps {
  repoId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  repoLabel?: string
  onOnboarded?: (repository: Repository) => void
}

export function ExternalRepoOnboardDialog({
  repoId,
  open,
  onOpenChange,
  repoLabel,
  onOnboarded,
}: ExternalRepoOnboardDialogProps) {
  const { repos, refresh } = useReposStore()
  const {
    startOnboard,
    onboarding,
    onboardError,
    latest,
    phase,
    isComplete,
  } = useRepositoryOnboarding(open && repoId ? repoId : null)

  const label = useMemo(() => {
    if (repoLabel) return repoLabel
    if (!repoId) return ""
    const repo = repos.find((r) => r.id === repoId)
    return repo ? `${repo.owner}/${repo.name}` : repoId
  }, [repoLabel, repoId, repos])

  const handleLater = useCallback(() => {
    if (repoId) sessionStorage.setItem(adoptDismissKey(repoId), "1")
    onOpenChange(false)
  }, [repoId, onOpenChange])

  const handleOnboard = useCallback(async () => {
    const result = await startOnboard()
    if (result?.repository) {
      onOnboarded?.(result.repository)
      await refresh()
    }
  }, [startOnboard, onOnboarded, refresh])

  const showProgress = onboarding || phase === "completed" || phase === "failed"

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!onboarding) onOpenChange(next)
      }}
    >
      <AlertDialogContent className="bg-panel border-border sm:max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <GitPullRequest className="mt-0.5 h-5 w-5 shrink-0 text-ai-blue" />
            <div className="space-y-2 min-w-0">
              <AlertDialogTitle className="text-foreground text-left">
                {zh.externalRepoOnboard.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground text-left text-sm leading-relaxed">
                {zh.externalRepoOnboard.description}
              </AlertDialogDescription>
              {!showProgress ? (
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 text-left">
                  {zh.externalRepoOnboard.capabilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {label ? (
                <p className="text-xs font-mono text-foreground truncate">{label}</p>
              ) : null}
            </div>
          </div>
        </AlertDialogHeader>

        {showProgress ? (
          <RepositoryOnboardingProgress job={latest} />
        ) : null}

        {onboardError ? (
          <p className="text-xs text-risk-high">{onboardError}</p>
        ) : null}

        {isComplete ? (
          <p className="text-xs text-risk-low">{zh.adoptRepo.onboardingComplete}</p>
        ) : null}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          {!showProgress ? (
            <>
              <AlertDialogCancel
                onClick={handleLater}
                className="border-border bg-surface-2 hover:bg-surface-3"
              >
                {zh.externalRepoOnboard.later}
              </AlertDialogCancel>
              <button
                type="button"
                disabled={!repoId || onboarding}
                onClick={() => void handleOnboard()}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-ai-blue px-4 py-2 text-sm font-medium text-white hover:bg-[oklch(0.55_0.19_240)] disabled:opacity-60"
              >
                {onboarding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {zh.externalRepoOnboard.onboardNow}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!isComplete && onboarding}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-3 disabled:opacity-60"
            >
              {isComplete ? zh.common.close : zh.externalRepoOnboard.later}
            </button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
