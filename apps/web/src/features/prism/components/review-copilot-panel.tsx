"use client"

import type { AnalysisFinding, GovernanceRule, PullRequest } from "@reviewly/shared"
import { ExternalLink, FileText, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GovernanceRuleResults } from "@/features/prism/components/governance-rule-results"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import type { AnalysisPanelState } from "@/features/prism/lib/analysis-panel-state"
import type { ReviewInboxItem } from "@/features/prism/types/review-task"
import type { AiReviewerOpinion } from "@/lib/ai/ai-reviewer-opinion"
import { openGitHubReview } from "@/lib/github-pr-url"
import { cn } from "@/lib/utils"

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

type ReviewCopilotPanelProps = {
  pr: PullRequest
  panelState: AnalysisPanelState
  runningLabel?: string
  opinion: AiReviewerOpinion
  findings: AnalysisFinding[]
  taskForActions: ReviewInboxItem
  governanceRules?: GovernanceRule[]
  governanceLoading?: boolean
  onOpenFullReport?: () => void
  className?: string
}

function buildRiskPoints(findings: AnalysisFinding[]): string[] {
  return [...findings]
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity ?? "low"] ?? 9) -
        (SEVERITY_ORDER[b.severity ?? "low"] ?? 9),
    )
    .slice(0, 3)
    .map((f) => f.title || f.description || f.file)
    .filter(Boolean)
}

function PanelSkeleton() {
  return (
    <div className="space-y-3 py-1">
      <div className="h-3 bg-surface-2 rounded animate-pulse w-2/3" />
      <div className="h-3 bg-surface-2 rounded animate-pulse w-full" />
      <div className="h-3 bg-surface-2 rounded animate-pulse w-5/6" />
      <div className="h-3 bg-surface-2 rounded animate-pulse w-4/6" />
    </div>
  )
}

export function ReviewCopilotPanel({
  pr,
  panelState,
  runningLabel = "正在分析...",
  opinion,
  findings,
  taskForActions,
  governanceRules = [],
  governanceLoading = false,
  onOpenFullReport,
  className,
}: ReviewCopilotPanelProps) {
  const { navigate } = useNavigation()

  const parsed = opinion.parsedSections
  const riskLevel = parsed?.riskLevel ?? taskForActions.riskLevel
  const keyFindings =
    parsed?.keyFindings.length ? parsed.keyFindings : buildRiskPoints(findings)
  const reviewSuggestions = parsed?.reviewSuggestions ?? []

  return (
    <aside
      className={cn(
        "shrink-0 border-l border-border bg-panel/40 flex flex-col min-h-0 w-full md:w-80 lg:w-96",
        className,
      )}
    >
      <div className="px-3 py-3 border-b border-border flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">AI 分析</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] gap-1 shrink-0"
          onClick={() =>
            navigate("governance", {
              returnView: "ai-review",
              returnPrId: pr.id,
            })
          }
        >
          <Settings2 className="w-3.5 h-3.5" />
          工程治理
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-[12px]">
        {panelState === "running" ? (
          <div className="space-y-3">
            <p className="text-muted-foreground animate-pulse">{runningLabel}</p>
            <PanelSkeleton />
          </div>
        ) : null}

        {panelState === "completed" ? (
          <>
            <div>
              <p className="text-muted-foreground mb-1">AI 评审结论</p>
              <p
                className={cn(
                  "font-medium",
                  opinion.verdict === "approve" && "text-risk-low",
                  opinion.verdict === "request_changes" && "text-risk-medium",
                  opinion.verdict === "block" && "text-risk-high",
                )}
              >
                {opinion.verdictLabel}
              </p>
              {opinion.conclusionReason ? (
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  {opinion.conclusionReason}
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-muted-foreground mb-1">风险等级</p>
              <p className="font-medium text-foreground">{riskLevel}</p>
            </div>

            {keyFindings.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-1.5">关键发现</p>
                <ul className="space-y-1 list-disc list-inside text-foreground/90">
                  {keyFindings.map((p, i) => (
                    <li key={`${p}-${i}`}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <GovernanceRuleResults
              rules={governanceRules}
              loading={governanceLoading}
            />

            {reviewSuggestions.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-1.5">Review 建议</p>
                <ul className="space-y-1 list-disc list-inside text-foreground/90">
                  {reviewSuggestions.map((p, i) => (
                    <li key={`${p}-${i}`}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {onOpenFullReport ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8 text-[11px] gap-1.5"
                onClick={onOpenFullReport}
              >
                <FileText className="w-3.5 h-3.5" />
                查看完整报告
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {panelState === "completed" ? (
        <div className="shrink-0 px-3 py-3 border-t border-border">
          <Button
            type="button"
            size="sm"
            className="w-full gap-1.5 bg-ai-blue hover:bg-sky-300 text-primary-foreground"
            onClick={() => openGitHubReview(pr)}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            在 GitHub Review
          </Button>
        </div>
      ) : null}
    </aside>
  )
}
