"use client"

import { ReviewTaskList } from "@/features/prism/components/review-task-list"
import { useReviewTaskActions } from "@/hooks/use-review-task-actions"
import { useReviewTasks } from "@/hooks/use-review-tasks"
import type { ReviewTask } from "@/features/prism/types/review-task"

interface ReviewCenterProcessingViewProps {
  onSelectPr: (prId: string) => void
  reloadToken?: number
}

export function ReviewCenterProcessingView({
  onSelectPr,
  reloadToken = 0,
}: ReviewCenterProcessingViewProps) {
  const { tasks, loading, error, reload, defer, getNextInbox } = useReviewTasks({
    queue: "processing",
    reloadToken,
  })

  const { handleApprove, handleReview, handleDefer, handleRequestChanges } =
    useReviewTaskActions({
      onSelectPr,
      reload,
      defer,
      getNextInbox,
    })

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground">处理中</h2>
        <span className="text-xs text-muted-foreground font-mono">
          {loading ? "…" : `${tasks.length} 条`}
        </span>
      </div>

      <ReviewTaskList
        tasks={tasks}
        loading={loading}
        error={error}
        onSelect={(task: ReviewTask) => onSelectPr(task.prId)}
        onApprove={handleApprove}
        onReview={handleReview}
        onDefer={handleDefer}
        onRequestChanges={handleRequestChanges}
        emptyMessage="暂无处理中的 PR。"
      />
    </div>
  )
}
