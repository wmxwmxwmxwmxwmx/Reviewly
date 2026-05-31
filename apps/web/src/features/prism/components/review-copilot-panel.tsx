"use client"

import type { AnalysisFinding, PullRequest } from "@reviewly/shared"
import { FileText, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ReviewAdvisoryBar } from "@/features/prism/components/review-advisory-bar"
import { ReviewCompletionBanner } from "@/features/prism/components/review-completion-banner"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import type { ReviewInboxItem } from "@/features/prism/types/review-task"
import type { AiReviewerOpinion } from "@/lib/ai/ai-reviewer-opinion"
import { cn } from "@/lib/utils"

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

type ReviewCopilotPanelProps = {
  pr: PullRequest
  opinion: AiReviewerOpinion
  findings: AnalysisFinding[]
  taskForActions: ReviewInboxItem
  analysisComplete: boolean
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

export function ReviewCopilotPanel({
  pr,
  opinion,
  findings,
  taskForActions,
  analysisComplete,
  onOpenFullReport,
  className,
}: ReviewCopilotPanelProps) {
  const { navigate } = useNavigation()

  const actionTask: ReviewInboxItem = {
    ...taskForActions,
    hasRealAi: analysisComplete,
    opinion,
  }

  const riskPoints = analysisComplete ? buildRiskPoints(findings) : []
  const reasonPoints = analysisComplete ? opinion.points.slice(0, 5) : []
  const highRiskCount = findings.filter(
    (f) => f.severity === "critical" || f.severity === "high",
  ).length

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
        {!analysisComplete ? (
          <div className="space-y-2">
            <div>
              <p className="text-muted-foreground mb-1">AI 评审结论</p>
              <p className="font-medium text-muted-foreground">待完成分析</p>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              请先点击「开始分析」生成基于改动的评审意见。
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-muted-foreground mb-1">AI 评审结论</p>
              <p
                className={cn(
                  "font-medium",
                  opinion.verdict === "approve" && "text-risk-low",
                  opinion.verdict === "request_changes" && "text-risk-medium",
                  opinion.verdict === "block" && "text-risk-high",
                  opinion.verdict === "pending" && "text-muted-foreground",
                )}
              >
                {opinion.verdictLabel}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground mb-1">风险等级</p>
              <p className="font-medium text-foreground">{actionTask.riskLevel}</p>
            </div>

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

            {reasonPoints.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-1.5">原因</p>
                <ul className="space-y-1 list-disc list-inside text-foreground/90">
                  {reasonPoints.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {riskPoints.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-1.5">关键风险点</p>
                <ol className="space-y-1 list-decimal list-inside text-foreground/90">
                  {riskPoints.map((p, i) => (
                    <li key={`${p}-${i}`}>{p}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            <ReviewCompletionBanner pr={pr} highRiskCount={highRiskCount} />

            <div className="pt-2 border-t border-border">
              <ReviewAdvisoryBar
                task={actionTask}
                suggestedLabel={opinion.verdictLabel}
                layout="panel"
              />
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
