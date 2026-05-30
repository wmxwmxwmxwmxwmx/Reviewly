"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"

import type { PullRequest, Repository } from "@reviewly/shared"

import { useRepositoryJobs } from "@/hooks/use-repository-jobs"
import { adoptRepository } from "@/lib/api/repos"
import { prNeedsAdoption } from "@/lib/repos-adopt"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

function dismissKey(repoId: string) {
  return `prism:dismiss-adopt:${repoId}`
}

function isDismissed(repoId: string): boolean {
  if (typeof sessionStorage === "undefined") return false
  return sessionStorage.getItem(dismissKey(repoId)) === "1"
}

export function shouldShowAdoptBanner(pr: PullRequest | null | undefined): boolean {
  if (!pr?.repoId) return false
  if (isDismissed(pr.repoId)) return false
  return prNeedsAdoption(pr)
}

interface AdoptRepoBannerProps {
  pr: PullRequest
  onAdopted?: (repository: Repository) => void
  onRefreshPr?: () => void
}

export function AdoptRepoBanner({ pr, onAdopted, onRefreshPr }: AdoptRepoBannerProps) {
  const [hidden, setHidden] = useState(false)
  const [adopting, setAdopting] = useState(false)
  const [adoptError, setAdoptError] = useState<string | null>(null)
  const [adopted, setAdopted] = useState(false)
  const repoId = pr.repoId

  const { latest, active, refresh } = useRepositoryJobs(
    adopted ? repoId : null,
    adopted,
  )

  useEffect(() => {
    if (repoId && isDismissed(repoId)) setHidden(true)
  }, [repoId])

  const handleDismiss = useCallback(() => {
    if (repoId) sessionStorage.setItem(dismissKey(repoId), "1")
    setHidden(true)
  }, [repoId])

  const handleAdopt = useCallback(async () => {
    if (!repoId || adopting) return
    setAdopting(true)
    setAdoptError(null)
    try {
      const result = await adoptRepository(repoId)
      setAdopted(true)
      onAdopted?.(result.repository)
      onRefreshPr?.()
      void refresh()
    } catch (e: unknown) {
      setAdoptError(e instanceof Error ? e.message : zh.adoptRepo.error)
    } finally {
      setAdopting(false)
    }
  }, [repoId, adopting, onAdopted, onRefreshPr, refresh])

  if (hidden || !shouldShowAdoptBanner(pr)) return null

  const repoLabel = pr.repo ?? pr.repoId

  return (
    <div className="mx-5 mt-3 rounded-md border border-ai-blue/30 bg-ai-blue/5 px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ai-blue" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium text-foreground">{zh.adoptRepo.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {zh.adoptRepo.description.replace("{repo}", repoLabel)}
          </p>
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
            {zh.adoptRepo.capabilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {adopted && latest ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{latest.message || zh.repoJobStatus.running}</span>
                <span>{latest.progress ?? 0}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    latest.status === "failed"
                      ? "bg-risk-high"
                      : latest.status === "success"
                        ? "bg-risk-low"
                        : "bg-ai-blue",
                  )}
                  style={{ width: `${Math.min(100, latest.progress ?? 0)}%` }}
                />
              </div>
              {latest.status === "failed" ? (
                <p className="text-[11px] text-risk-high">{latest.message}</p>
              ) : null}
              {active ? (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {zh.adoptRepo.onboardingInProgress}
                </p>
              ) : latest.status === "success" ? (
                <p className="text-[11px] text-risk-low">{zh.adoptRepo.onboardingComplete}</p>
              ) : null}
            </div>
          ) : null}

          {adoptError ? <p className="text-xs text-risk-high">{adoptError}</p> : null}

          {!adopted ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={adopting}
                onClick={() => void handleAdopt()}
                className="inline-flex items-center gap-1.5 rounded-md bg-ai-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-[oklch(0.55_0.19_240)] disabled:opacity-60"
              >
                {adopting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {zh.adoptRepo.adoptButton}
              </button>
              <button
                type="button"
                disabled={adopting}
                onClick={handleDismiss}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-3"
              >
                {zh.adoptRepo.dismissButton}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
