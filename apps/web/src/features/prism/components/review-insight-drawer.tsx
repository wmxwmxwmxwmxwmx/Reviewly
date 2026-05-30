"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, X } from "lucide-react"
import type { AnalysisFinding, AnalysisSummary, AiUsageMetrics, PullRequest } from "@reviewly/shared"

import { AISummary } from "@/features/prism/components/ai-summary"
import { ReviewQuickVerdict } from "@/features/prism/components/review-quick-verdict"
import { ReviewTimeline } from "@/features/prism/components/review-timeline"
import { cn } from "@/lib/utils"

interface ReviewInsightDrawerProps {
  open: boolean
  onClose: () => void
  prId: string
  pr: PullRequest
  findings: AnalysisFinding[]
  latest?: AnalysisSummary | null
  generatedSummary?: string
  hasCompletedAnalysis?: boolean
  fallbackScores?: {
    riskScore?: number
    securityScore?: number
    performanceScore?: number
    maintainabilityScore?: number
  }
  scanning?: boolean
  streaming?: boolean
  model?: string
  jobSummary?: string
  hasAnalysis?: boolean
  restoring?: boolean
  error?: string | null
  usage?: AiUsageMetrics
  reviewTimelineKey?: number
  onGoToSettings?: () => void
}

export function ReviewInsightDrawer({
  open,
  onClose,
  prId,
  pr,
  findings,
  latest,
  generatedSummary,
  hasCompletedAnalysis,
  fallbackScores,
  scanning,
  streaming,
  model,
  jobSummary,
  hasAnalysis,
  restoring,
  error,
  usage,
  reviewTimelineKey = 0,
  onGoToSettings,
}: ReviewInsightDrawerProps) {
  const [ruleSummaryOpen, setRuleSummaryOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="flex-1 bg-black/60"
        aria-label="关闭 AI 洞察"
        onClick={onClose}
      />
      <aside
        className={cn(
          "flex flex-col min-h-0 w-full max-w-[min(100%,380px)]",
          "bg-panel border-l border-border shadow-2xl",
        )}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">AI 洞察</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <ReviewQuickVerdict
            findings={findings}
            latest={latest}
            prTitle={pr.title}
            repoLabel={pr.repo}
            prNumber={pr.number}
            aiSummary={generatedSummary}
            hasCompletedAnalysis={hasCompletedAnalysis}
            fallbackScores={fallbackScores}
          />

          <AISummary
            variant="panel"
            defaultDeepOpen
            scanning={scanning}
            streaming={streaming}
            model={model}
            generatedSummary={generatedSummary}
            hasAnalysis={hasAnalysis}
            restoring={restoring}
            error={error}
            usage={usage}
            onGoToSettings={onGoToSettings}
          />

          {jobSummary && jobSummary !== generatedSummary ? (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-accent text-left"
                onClick={() => setRuleSummaryOpen((v) => !v)}
              >
                {ruleSummaryOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs font-semibold text-foreground">规则扫描摘要</span>
              </button>
              {ruleSummaryOpen ? (
                <div className="px-3 pb-3 border-t border-border pt-2 text-[11px] text-muted-foreground whitespace-pre-wrap">
                  {jobSummary}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-accent text-left"
              onClick={() => setActivityOpen((v) => !v)}
            >
              {activityOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-semibold text-foreground">审批历史</span>
            </button>
            {activityOpen ? (
              <div className="px-3 pb-3 border-t border-border pt-2">
                <ReviewTimeline prId={prId} refreshKey={reviewTimelineKey} />
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  )
}
