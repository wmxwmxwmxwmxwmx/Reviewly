"use client"

import { Check, Circle, Loader2, X } from "lucide-react"

import type { OnboardingPhase, RepositoryJob } from "@reviewly/shared"

import {
  mapJobToOnboardingPhase,
  ONBOARDING_PHASES,
} from "@/lib/repository-onboarding"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

const phaseLabels: Record<OnboardingPhase, string> = {
  queued: zh.onboardingPhases.queued,
  cloning: zh.onboardingPhases.cloning,
  scanning: zh.onboardingPhases.scanning,
  analyzing: zh.onboardingPhases.analyzing,
  completed: zh.onboardingPhases.completed,
  failed: zh.onboardingPhases.failed,
}

function phaseIndex(phase: OnboardingPhase): number {
  if (phase === "failed") return -1
  const idx = ONBOARDING_PHASES.indexOf(phase)
  return idx >= 0 ? idx : 0
}

function StepIcon({
  phase,
  current,
  failed,
}: {
  phase: OnboardingPhase
  current: OnboardingPhase
  failed: boolean
}) {
  const currentIdx = phaseIndex(current)
  const stepIdx = phaseIndex(phase)
  const done = !failed && currentIdx > stepIdx
  const active = !failed && current === phase
  const stepFailed = failed && current === "failed" && phase === ONBOARDING_PHASES[stepIdx]

  if (stepFailed) {
    return <X className="h-3.5 w-3.5 text-risk-high" />
  }
  if (done || (current === "completed" && phase !== "completed")) {
    return <Check className="h-3.5 w-3.5 text-risk-low" />
  }
  if (active) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-ai-blue" />
  }
  return <Circle className="h-3 w-3 text-muted-foreground/50" />
}

interface RepositoryOnboardingProgressProps {
  job?: RepositoryJob | null
  className?: string
  compact?: boolean
}

export function RepositoryOnboardingProgress({
  job,
  className,
  compact = false,
}: RepositoryOnboardingProgressProps) {
  const phase = mapJobToOnboardingPhase(job)
  const failed = phase === "failed"
  const progress = job?.progress ?? 0

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "flex items-center justify-between gap-1",
          compact ? "flex-wrap" : "overflow-x-auto pb-1",
        )}
      >
        {ONBOARDING_PHASES.map((step, idx) => {
          const currentIdx = phaseIndex(phase)
          const stepIdx = idx
          const isActive = phase === step
          const isDone = !failed && (currentIdx > stepIdx || phase === "completed")

          return (
            <div key={step} className="flex items-center gap-1 min-w-0 flex-1">
              <div
                className={cn(
                  "flex flex-col items-center gap-1 min-w-[4.5rem] text-center",
                  isActive && "text-ai-blue",
                  isDone && "text-risk-low",
                  !isActive && !isDone && "text-muted-foreground",
                )}
              >
                <StepIcon phase={step} current={phase} failed={failed} />
                <span className="text-[10px] font-medium leading-tight truncate w-full">
                  {phaseLabels[step]}
                </span>
              </div>
              {idx < ONBOARDING_PHASES.length - 1 ? (
                <div
                  className={cn(
                    "h-px flex-1 min-w-2 mb-4",
                    isDone ? "bg-risk-low/60" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
          )
        })}
      </div>

      {job ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-2">
            <span className="truncate">{job.message || phaseLabels[phase]}</span>
            <span className="shrink-0">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                failed
                  ? "bg-risk-high"
                  : phase === "completed"
                    ? "bg-risk-low"
                    : "bg-ai-blue",
              )}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
