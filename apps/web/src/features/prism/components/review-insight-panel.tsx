"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, X } from "lucide-react"
import type { AnalysisFinding, AnalysisSummary, AiUsageMetrics, PullRequest, ReviewStatus } from "@reviewly/shared"

import { AISummary } from "@/features/prism/components/ai-summary"
import { ReviewDecisionBar } from "@/features/prism/components/review-decision-bar"
import { ReviewQuickVerdict } from "@/features/prism/components/review-quick-verdict"
import { ReviewTimeline } from "@/features/prism/components/review-timeline"
import { cn } from "@/lib/utils"

interface ReviewInsightPanelProps {
  prId: string
  pr: PullRequest
  reviewStatus?: ReviewStatus
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
  onUpdated?: () => void
  onStatusChange?: (status: ReviewStatus) => void
  onClose?: () => void
  className?: string
}

export function ReviewInsightPanel({
  prId,
  pr,
  reviewStatus,
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
  onUpdated,
  onStatusChange,
  onClose,
  className,
}: ReviewInsightPanelProps) {
  const [activityOpen, setActivityOpen] = useState(false)

  return (
    <aside
      className={cn(
        "flex flex-col min-h-0 bg-panel/50 border-l border-border w-full xl:w-[340px] shrink-0",
        className,
      )}
    >
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">洞察与决策</span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground xl:hidden"
            aria-label="关闭面板"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
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
          defaultDeepOpen={false}
          scanning={scanning}
          streaming={streaming}
          model={model}
          generatedSummary={generatedSummary}
          jobSummary={jobSummary}
          hasAnalysis={hasAnalysis}
          restoring={restoring}
          error={error}
          usage={usage}
          onGoToSettings={onGoToSettings}
        />

        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            人工决策
          </p>
          <ReviewDecisionBar
            prId={prId}
            reviewStatus={reviewStatus}
            onUpdated={onUpdated}
            onStatusChange={onStatusChange}
            compact
          />
        </div>

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
  )
}
