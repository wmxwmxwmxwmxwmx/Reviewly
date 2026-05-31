"use client"

import { ReviewInboxCardList } from "@/features/prism/components/review-inbox-card-list"
import { useReviewInbox } from "@/hooks/use-review-inbox"

interface ReviewCenterHistoryViewProps {
  onSelectPr: (prId: string) => void
  reloadToken?: number
}

export function ReviewCenterHistoryView({
  onSelectPr,
  reloadToken = 0,
}: ReviewCenterHistoryViewProps) {
  const { tasks, loading, error } = useReviewInbox({
    mode: "history",
    reloadToken,
  })

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground">历史记录</h2>
        <span className="text-xs text-muted-foreground font-mono">
          {loading ? "…" : `${tasks.length} 条已查阅`}
        </span>
      </div>

      <ReviewInboxCardList
        items={tasks}
        loading={loading}
        error={error}
        onSelect={(item) => onSelectPr(item.prId)}
        emptyMessage="暂无历史记录 — 打开 PR 详情后将出现在这里。"
      />
    </div>
  )
}
