"use client"

import { useCallback } from "react"

import type { ReviewTask } from "@/features/prism/types/review-task"
import { useToast } from "@/hooks/use-toast"
import { patchReviewStatus } from "@/lib/api/review-center"
import { PrismApiError } from "@/lib/api/client"

type UseReviewTaskActionsOptions = {
  onSelectPr: (prId: string) => void
  onApproved?: (nextPrId: string | null) => void
  reload: () => void
  defer: (prId: string) => void
  getNextInbox: (currentPrId: string | null) => ReviewTask | null
}

export function useReviewTaskActions({
  onSelectPr,
  onApproved,
  reload,
  defer,
  getNextInbox,
}: UseReviewTaskActionsOptions) {
  const { toast } = useToast()

  const handleApprove = useCallback(
    async (task: ReviewTask) => {
      try {
        await patchReviewStatus(task.prId, "APPROVED")
        reload()
        const next = getNextInbox(task.prId)
        onApproved?.(next?.prId ?? null)
        if (next) {
          toast({ title: "已通过", description: `正在打开下一个：${next.title}` })
          onSelectPr(next.prId)
        } else {
          toast({ title: "已通过", description: "队列已清空" })
        }
      } catch (e) {
        toast({
          title: "批准失败",
          description: e instanceof PrismApiError ? e.message : undefined,
          variant: "destructive",
        })
      }
    },
    [getNextInbox, onApproved, onSelectPr, reload, toast],
  )

  const handleReview = useCallback(
    async (task: ReviewTask) => {
      try {
        if (task.source.reviewStatus !== "IN_REVIEW") {
          await patchReviewStatus(task.prId, "IN_REVIEW")
          reload()
        }
      } catch {
        /* 进入详情不阻断 */
      }
      onSelectPr(task.prId)
    },
    [onSelectPr, reload],
  )

  const handleDefer = useCallback(
    (task: ReviewTask) => {
      defer(task.prId)
      toast({ title: "已延后", description: "该 PR 已移至队尾" })
    },
    [defer, toast],
  )

  const handleRequestChanges = useCallback(
    async (task: ReviewTask) => {
      try {
        await patchReviewStatus(task.prId, "CHANGES_REQUESTED")
        reload()
        toast({ title: "已要求修改" })
      } catch (e) {
        toast({
          title: "操作失败",
          description: e instanceof PrismApiError ? e.message : undefined,
          variant: "destructive",
        })
      }
    },
    [reload, toast],
  )

  return {
    handleApprove,
    handleReview,
    handleDefer,
    handleRequestChanges,
  }
}
