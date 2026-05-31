"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InboxSegmentControl } from "@/features/prism/components/inbox-segment-control"
import { ReviewInboxCardList } from "@/features/prism/components/review-inbox-card-list"
import type { InboxSegment } from "@/features/prism/types/review-task"
import { useReviewInbox } from "@/hooks/use-review-inbox"
import { zh } from "@/lib/i18n/zh"

interface ReviewCenterInboxViewProps {
  onSelectPr: (prId: string) => void
  reloadToken?: number
  onImportOpenChange: (open: boolean) => void
}

export function ReviewCenterInboxView({
  onSelectPr,
  reloadToken = 0,
  onImportOpenChange,
}: ReviewCenterInboxViewProps) {
  const [segment, setSegment] = useState<InboxSegment>("unread")
  const { tasks, loading, error } = useReviewInbox({
    mode: "inbox",
    segment,
    reloadToken,
  })

  const emptyAction = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0 h-7 text-xs"
      onClick={() => onImportOpenChange(true)}
    >
      <Plus className="w-3.5 h-3.5" />
      {zh.aiReview.importButton}
    </Button>
  )

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-foreground">收件箱</h2>
        <span className="text-xs text-muted-foreground font-mono">
          {loading ? "…" : `${tasks.length} 条需关注`}
        </span>
      </div>

      <InboxSegmentControl active={segment} onChange={setSegment} />

      <ReviewInboxCardList
        items={tasks}
        loading={loading}
        error={error}
        onSelect={(item) => onSelectPr(item.prId)}
        emptyMessage="收件箱为空 — 纳管仓库的新 PR 将自动出现在这里。"
        emptyAction={emptyAction}
      />
    </div>
  )
}
