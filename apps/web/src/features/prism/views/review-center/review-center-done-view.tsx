"use client"

import { useCallback } from "react"

import { ReviewTaskList } from "@/features/prism/components/review-task-list"
import { useToast } from "@/hooks/use-toast"
import { useReviewTasks } from "@/hooks/use-review-tasks"
import type { ReviewTask } from "@/features/prism/types/review-task"

interface ReviewCenterDoneViewProps {
  onSelectPr: (prId: string) => void
  reloadToken?: number
}

export function ReviewCenterDoneView({
  onSelectPr,
  reloadToken = 0,
}: ReviewCenterDoneViewProps) {
  const { toast } = useToast()
  const { tasks, loading, error, reload, returnToInbox, clearOverrides } = useReviewTasks({
    queue: "done",
    reloadToken,
  })

  const handleReturnToInbox = useCallback(
    (task: ReviewTask) => {
      returnToInbox(task.prId)
      reload()
      toast({ title: "已放回优先处理", description: task.title })
    },
    [returnToInbox, reload, toast],
  )

  const handleRescore = useCallback(
    (task: ReviewTask) => {
      clearOverrides(task.prId)
      reload()
      toast({ title: "已重新评估", description: task.title })
    },
    [clearOverrides, reload, toast],
  )

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground">已完成</h2>
        <span className="text-xs text-muted-foreground font-mono">
          {loading ? "…" : `${tasks.length} 条`}
        </span>
      </div>

      <ReviewTaskList
        tasks={tasks}
        loading={loading}
        error={error}
        showReturnActions
        onSelect={(task: ReviewTask) => onSelectPr(task.prId)}
        onApprove={() => {}}
        onReview={(task) => onSelectPr(task.prId)}
        onDefer={() => {}}
        onReturnToInbox={handleReturnToInbox}
        onRescore={handleRescore}
        emptyMessage="暂无已完成的 PR。"
      />
    </div>
  )
}
