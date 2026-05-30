"use client"

import { useCallback, useState } from "react"

import type { OnboardingPhase, Repository } from "@reviewly/shared"

import { useRepositoryJobs } from "@/hooks/use-repository-jobs"
import { onboardRepository } from "@/lib/api/repos"
import { mapJobToOnboardingPhase } from "@/lib/repository-onboarding"
import { zh } from "@/lib/i18n/zh"

export { mapJobToOnboardingPhase, ONBOARDING_PHASES } from "@/lib/repository-onboarding"

export function useRepositoryOnboarding(repoId: string | null) {
  const [onboarding, setOnboarding] = useState(false)
  const [onboardError, setOnboardError] = useState<string | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)

  const { latest, active, refresh } = useRepositoryJobs(
    onboarding ? repoId : null,
    onboarding,
  )

  const phase: OnboardingPhase = mapJobToOnboardingPhase(latest)

  const startOnboard = useCallback(async () => {
    if (!repoId || onboarding) return null
    setOnboarding(true)
    setOnboardError(null)
    try {
      const result = await onboardRepository(repoId)
      setRepository(result.repository)
      void refresh()
      return result
    } catch (e: unknown) {
      setOnboardError(e instanceof Error ? e.message : zh.adoptRepo.error)
      setOnboarding(false)
      return null
    }
  }, [repoId, onboarding, refresh])

  const isComplete = phase === "completed"
  const isFailed = phase === "failed"

  return {
    startOnboard,
    onboarding,
    onboardError,
    repository,
    latest,
    active,
    phase,
    isComplete,
    isFailed,
    refresh,
  }
}
