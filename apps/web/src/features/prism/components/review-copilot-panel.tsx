"use client"

import type { AnalysisFinding, PullRequest } from "@reviewly/shared"
import { FileText, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { OneClickActionBar } from "@/features/prism/components/one-click-action-bar"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { verdictToRecommendedAction } from "@/features/prism/lib/review-task-verdict"
import { useReviewTaskActions } from "@/hooks/use-review-task-actions"
import { useReviewTasks } from "@/hooks/use-review-tasks"
import type { AiReviewerOpinion } from "@/lib/ai/ai-reviewer-opinion"
import type { ReviewTask } from "@/features/prism/types/review-task"
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
  taskForActions: ReviewTask
  analysisComplete: boolean
  onOpenFullReport?: () => void
  onStartReview: () => void
  onReviewStatusChanged?: () => void
  reloadPr?: () => void
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
  onStartReview,
  onReviewStatusChanged,
  reloadPr,
  className,
}: ReviewCopilotPanelProps) {
  const { navigate } = useNavigation()
  const { reload, defer, getNextInbox } = useReviewTasks()

  const combinedReload = () => {
    reload()
    reloadPr?.()
  }

  const { handleApprove, handleReview, handleDefer, handleRequestChanges } =
    useReviewTaskActions({
      onSelectPr: (id) =>
        navigate("ai-review", {
          prId: id,
          reviewTab: "inbox",
        }),
      onApproved: (nextId) => {
        onReviewStatusChanged?.()
        if (nextId) {
          navigate("ai-review", { prId: nextId, reviewTab: "inbox" })
        } else {
          navigate("ai-review", { aiReviewList: true, reviewTab: "inbox" })
        }
      },
      reload: combinedReload,
      defer,
      getNextInbox,
    })

  const actionTask: ReviewTask = {
    ...taskForActions,
    recommendedAction:
      verdictToRecommendedAction(opinion.verdict, false) ?? taskForActions.recommendedAction,
    hasRealAi: analysisComplete,
    opinion,
  }

  const riskPoints = analysisComplete ? buildRiskPoints(findings) : []
  const reasonPoints = analysisComplete ? opinion.points.slice(0, 5) : []

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
                  opinion.suggestChanges ? "text-risk-high" : "text-risk-low",
                )}
              >
                {opinion.verdictLabel}
              </p>
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

            <div className="pt-2 border-t border-border">
              <OneClickActionBar
                task={actionTask}
                suggestedLabel={opinion.verdictLabel}
                layout="panel"
                onApprove={handleApprove}
                onReview={() => {
                  void handleReview(actionTask)
                  onStartReview()
                }}
                onDefer={handleDefer}
                onRequestChanges={handleRequestChanges}
              />
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
