"use client"

import { cn } from "@/lib/utils"
import type { ReviewTask } from "@/features/prism/types/review-task"

type OneClickActionBarProps = {
  task: ReviewTask
  onApprove: (task: ReviewTask) => void
  onReview: (task: ReviewTask) => void
  onDefer: (task: ReviewTask) => void
  onRequestChanges?: (task: ReviewTask) => void
  layout?: "inline" | "panel"
  className?: string
}

export function OneClickActionBar({
  task,
  onApprove,
  onReview,
  onDefer,
  onRequestChanges,
  layout = "inline",
  className,
}: OneClickActionBarProps) {
  const isPanel = layout === "panel"

  return (
    <div
      className={cn(
        isPanel
          ? "flex flex-col gap-2"
          : "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {isPanel ? (
        <p className="text-[11px] text-muted-foreground mb-1">
          👉 建议：<span className="text-foreground font-medium">{task.recommendedAction}</span>
        </p>
      ) : null}
      <div className={cn("flex flex-wrap gap-1.5", isPanel && "flex-col sm:flex-row")}>
        <button
          type="button"
          onClick={() => onApprove(task)}
          className="px-2.5 py-1 rounded text-[11px] font-medium bg-risk-low/15 text-risk-low hover:bg-risk-low/25 transition-colors"
        >
          通过
        </button>
        <button
          type="button"
          onClick={() => onReview(task)}
          className="px-2.5 py-1 rounded text-[11px] font-medium bg-ai-blue/15 text-ai-blue hover:bg-ai-blue/25 transition-colors"
        >
          {isPanel ? "开始审查" : "审查"}
        </button>
        <button
          type="button"
          onClick={() => onDefer(task)}
          className="px-2.5 py-1 rounded text-[11px] font-medium bg-surface-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          延后
        </button>
        {onRequestChanges ? (
          <button
            type="button"
            onClick={() => onRequestChanges(task)}
            className="px-2.5 py-1 rounded text-[11px] font-medium bg-risk-medium/15 text-risk-medium hover:bg-risk-medium/25 transition-colors"
          >
            要求修改
          </button>
        ) : null}
      </div>
    </div>
  )
}
