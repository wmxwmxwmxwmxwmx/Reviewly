"use client"

import { useMemo } from "react"
import type { AnalysisFinding, PullRequest } from "@reviewly/shared"
import { ArrowRight } from "lucide-react"

import { OneClickActionBar } from "@/features/prism/components/one-click-action-bar"
import { computePriority } from "@/features/prism/ai/priority-ranker"
import { readPrioritySettings } from "@/features/prism/lib/governance-priority-settings"
import { readStore } from "@/features/prism/lib/review-task-store"
import type { ReviewTask } from "@/features/prism/types/review-task"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useReviewTaskActions } from "@/hooks/use-review-task-actions"
import { useReviewTasks } from "@/hooks/use-review-tasks"
import { cn } from "@/lib/utils"

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

type ReviewCopilotPanelProps = {
  pr: PullRequest
  findings: AnalysisFinding[]
  aiSummary?: string
  onStartReview: () => void
  onReviewStatusChanged?: () => void
  reloadPr?: () => void
  className?: string
}

function buildRiskPoints(task: ReviewTask, findings: AnalysisFinding[]): string[] {
  const points: string[] = []
  if (task.signals.auth) points.push("auth")
  if (task.signals.payment) points.push("payment")
  if (task.signals.testsMissing) points.push("tests missing")
  if (task.signals.ciFailed) points.push("CI 失败")
  const topFindings = [...findings]
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity ?? "low"] ?? 9) -
        (SEVERITY_ORDER[b.severity ?? "low"] ?? 9),
    )
    .slice(0, 3)
  for (const f of topFindings) {
    const label = f.title || f.description || f.file
    if (label && !points.includes(label)) points.push(label)
  }
  return points.slice(0, 5)
}

function buildReasonBullets(task: ReviewTask): string[] {
  const bullets: string[] = []
  if (task.signals.auth) bullets.push("修改认证中间件")
  if (task.signals.payment) bullets.push("影响支付流程")
  if (task.signals.ciFailed) bullets.push("CI 失败")
  if (task.signals.testsMissing) bullets.push("缺少测试覆盖")
  if (task.signals.hotFiles) bullets.push("涉及热点文件")
  if (bullets.length === 0) bullets.push(task.priorityReason)
  return bullets
}

export function ReviewCopilotPanel({
  pr,
  findings,
  aiSummary,
  onStartReview,
  onReviewStatusChanged,
  reloadPr,
  className,
}: ReviewCopilotPanelProps) {
  const { navigate } = useNavigation()
  const { reload, defer, getNextInbox } = useReviewTasks()

  const task = useMemo(() => {
    const store = readStore()
    const settings = readPrioritySettings()
    const branchCache = new Map([[pr.id, pr.sourceBranch]])
    const listItem = {
      ...pr,
      aiSummary:
        pr.aiSummary ??
        (aiSummary
          ? { content: aiSummary, analyzedAt: new Date().toISOString() }
          : null),
    }
    return computePriority([listItem], { settings, store, branchCache })[0] ?? null
  }, [pr, aiSummary])

  const combinedReload = useMemo(
    () => () => {
      reload()
      reloadPr?.()
    },
    [reload, reloadPr],
  )

  const { handleApprove, handleReview, handleDefer, handleRequestChanges } =
    useReviewTaskActions({
      onSelectPr: (id) => navigate("ai-review", { prId: id, reviewTab: "inbox" }),
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

  if (!task) return null

  const reasons = buildReasonBullets(task)
  const riskPoints = buildRiskPoints(task, findings)

  return (
    <aside
      className={cn(
        "shrink-0 border-l border-border bg-panel/40 flex flex-col min-h-0 w-full md:w-80 lg:w-96",
        className,
      )}
    >
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">AI 分析结果</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-[12px]">
        <div>
          <p className="text-muted-foreground mb-1">风险等级</p>
          <p className="font-medium text-foreground">{task.riskLevel}</p>
        </div>

        <div>
          <p className="text-muted-foreground mb-1.5">原因</p>
          <ul className="space-y-1 list-disc list-inside text-foreground/90">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

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

        {task.aiSummary ? (
          <div>
            <p className="text-muted-foreground mb-1">AI 摘要</p>
            <p className="text-foreground/80 leading-relaxed line-clamp-6">{task.aiSummary}</p>
          </div>
        ) : null}

        <div className="pt-2 border-t border-border">
          <p className="text-[11px] text-muted-foreground mb-2">AI 推荐操作</p>
          <p className="text-[11px] mb-2">
            当前风险：<span className="font-medium text-foreground">{task.riskLevel}</span>
          </p>
          <OneClickActionBar
            task={task}
            layout="panel"
            onApprove={handleApprove}
            onReview={() => {
              void handleReview(task)
              onStartReview()
            }}
            onDefer={handleDefer}
            onRequestChanges={handleRequestChanges}
          />
        </div>

        <button
          type="button"
          onClick={() => navigate("governance")}
          className="inline-flex items-center gap-1 text-[11px] text-ai-blue hover:underline"
        >
          工程治理
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </aside>
  )
}
