"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { OneClickActionBar } from "@/features/prism/components/one-click-action-bar"
import type { ReviewTask } from "@/features/prism/types/review-task"

function signalLabels(task: ReviewTask): string[] {
  const labels: string[] = []
  if (task.signals.auth) labels.push("auth 模块")
  if (task.signals.payment) labels.push("支付")
  if (task.signals.ciFailed) labels.push("CI失败")
  if (task.signals.testsMissing) labels.push("测试缺失")
  if (task.signals.hotFiles) labels.push("热点文件")
  return labels
}

type ReviewTaskListProps = {
  tasks: ReviewTask[]
  loading?: boolean
  error?: string | null
  onSelect: (task: ReviewTask) => void
  onApprove: (task: ReviewTask) => void
  onReview: (task: ReviewTask) => void
  onDefer: (task: ReviewTask) => void
  onRequestChanges?: (task: ReviewTask) => void
  onReturnToInbox?: (task: ReviewTask) => void
  onRescore?: (task: ReviewTask) => void
  showReturnActions?: boolean
  emptyMessage?: string
  emptyAction?: ReactNode
}

export function ReviewTaskList({
  tasks,
  loading,
  error,
  onSelect,
  onApprove,
  onReview,
  onDefer,
  onRequestChanges,
  onReturnToInbox,
  onRescore,
  showReturnActions = false,
  emptyMessage = "暂无 PR 任务",
  emptyAction,
}: ReviewTaskListProps) {
  if (loading) {
    return (
      <div className="divide-y divide-border rounded-lg border border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-3 py-3 animate-pulse">
            <div className="h-3 bg-surface-2 rounded w-1/3 mb-2" />
            <div className="h-4 bg-surface-2 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-risk-high py-4">{error}</p>
  }

  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        {emptyAction}
      </div>
    )
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border max-h-[calc(100vh-220px)] overflow-y-auto">
      {tasks.map((task, index) => {
        const signals = signalLabels(task)
        return (
          <article
            key={task.prId}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(task)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onSelect(task)
              }
            }}
            className="group relative px-3 py-2.5 hover:bg-surface-2/50 cursor-pointer transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ai-blue"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-ai-blue">
                    🔥 优先级 #{index + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                      task.riskLevel === "严重" || task.riskLevel === "高"
                        ? "border-risk-high/40 text-risk-high bg-risk-high/10"
                        : task.riskLevel === "中"
                          ? "border-amber-400/40 text-amber-400 bg-amber-400/10"
                          : "border-border text-muted-foreground bg-surface-2",
                    )}
                  >
                    {task.riskLevel}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {task.priorityScore} 分
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground truncate">
                  仓库：{task.repo}
                </p>
                <p className="text-[13px] font-medium text-foreground truncate">{task.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  分支：{task.branch}
                </p>

                <div className="text-[11px] text-muted-foreground">
                  <span>变更：{task.filesChanged} 个文件</span>
                  {signals.length > 0 ? (
                    <span> · {signals.join(" · ")}</span>
                  ) : null}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  <span className="text-foreground/80">AI原因：</span>
                  {task.priorityReason}
                </p>

                <p className="text-[11px] text-ai-blue">
                  👉 推荐操作：{task.recommendedAction}（约 {task.estimatedMinutes} 分钟）
                </p>
              </div>

              {!showReturnActions ? (
                <OneClickActionBar
                  task={task}
                  onApprove={onApprove}
                  onReview={onReview}
                  onDefer={onDefer}
                  onRequestChanges={onRequestChanges}
                  layout="inline"
                  className="shrink-0 pt-1"
                />
              ) : (
                <div
                  className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onReturnToInbox ? (
                    <button
                      type="button"
                      onClick={() => onReturnToInbox(task)}
                      className="px-2.5 py-1 rounded text-[11px] font-medium bg-ai-blue/15 text-ai-blue hover:bg-ai-blue/25 whitespace-nowrap"
                    >
                      ↩ 放回优先处理
                    </button>
                  ) : null}
                  {onRescore ? (
                    <button
                      type="button"
                      onClick={() => onRescore(task)}
                      className="px-2.5 py-1 rounded text-[11px] font-medium bg-surface-2 text-muted-foreground hover:text-foreground whitespace-nowrap"
                    >
                      🔁 重新评估
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
