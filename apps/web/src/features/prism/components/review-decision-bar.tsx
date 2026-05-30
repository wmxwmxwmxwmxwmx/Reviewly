"use client"

import { useCallback, useEffect, useState } from "react"
import type {
  ApprovalCheckResult,
  ReviewComment,
  ReviewCommentType,
  ReviewStatus,
} from "@reviewly/shared"
import { CheckCircle2, MessageSquare, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchApprovalCheck,
  fetchReviewComments,
  patchReviewStatus,
  postReviewComment,
} from "@/lib/api/review-center"
import {
  REVIEW_STATUS_LABELS,
  reviewStatusBadgeClass,
} from "@/features/prism/lib/review-status-utils"
import { PrismApiError } from "@/lib/api/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const MANUAL_STATUSES: ReviewStatus[] = [
  "OPEN",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
]

interface ReviewDecisionBarProps {
  prId: string
  reviewStatus?: ReviewStatus
  onUpdated?: () => void
  onStatusChange?: (status: ReviewStatus) => void
  compact?: boolean
}

export function ReviewDecisionBar({
  prId,
  reviewStatus = "OPEN",
  onUpdated,
  onStatusChange,
  compact = false,
}: ReviewDecisionBarProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState<ReviewStatus>(reviewStatus)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [approvalCheck, setApprovalCheck] = useState<ApprovalCheckResult | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<ReviewCommentType>("COMMENT")
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  useEffect(() => {
    setStatus(reviewStatus)
  }, [reviewStatus])

  const applyStatus = useCallback(
    (next: ReviewStatus) => {
      setStatus(next)
      onStatusChange?.(next)
      onUpdated?.()
    },
    [onStatusChange, onUpdated],
  )

  const reload = useCallback(() => {
    const ac = new AbortController()
    void Promise.all([
      fetchReviewComments(prId, ac.signal),
      fetchApprovalCheck(prId, ac.signal),
    ])
      .then(([c, check]) => {
        setComments(c.items)
        setApprovalCheck(check)
      })
      .catch(() => {})
    return () => ac.abort()
  }, [prId])

  useEffect(() => reload(), [reload])

  const changeStatus = async (next: ReviewStatus) => {
    if (next === status) return
    setStatusUpdating(true)
    try {
      const updated = await patchReviewStatus(prId, next)
      applyStatus(updated.reviewStatus ?? next)
      toast({ title: `状态已更新为「${REVIEW_STATUS_LABELS[next]}」` })
      reload()
    } catch (e) {
      toast({
        title: "状态更新失败",
        description: e instanceof PrismApiError ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setStatusUpdating(false)
    }
  }

  const openDialog = (type: ReviewCommentType) => {
    setDialogType(type)
    setContent("")
    setDialogOpen(true)
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const result = await postReviewComment(prId, { type: dialogType, content })
      const nextStatus = result.reviewStatus
      if (nextStatus) applyStatus(nextStatus)
      toast({
        title:
          dialogType === "APPROVE"
            ? "已批准"
            : dialogType === "REQUEST_CHANGES"
              ? "已要求修改"
              : "评论已提交",
      })
      setDialogOpen(false)
      reload()
    } catch (e) {
      toast({
        title: "提交失败",
        description: e instanceof PrismApiError ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const blocked = approvalCheck?.blocked ?? false
  const terminal = status === "MERGED" || status === "CLOSED"

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {!terminal ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => void changeStatus(v as ReviewStatus)}
            disabled={statusUpdating}
          >
            <SelectTrigger className={cn("h-8 text-xs", compact ? "w-full" : "w-[130px]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANUAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {REVIEW_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1.5 flex-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs flex-1 min-w-[4.5rem]"
              onClick={() => openDialog("COMMENT")}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              评论
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={blocked || statusUpdating}
              className="h-8 text-xs flex-1 min-w-[4.5rem]"
              onClick={() => openDialog("APPROVE")}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-risk-low" />
              批准
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={statusUpdating}
              className="h-8 text-xs flex-1 min-w-[4.5rem]"
              onClick={() => openDialog("REQUEST_CHANGES")}
            >
              <XCircle className="w-3.5 h-3.5 text-risk-high" />
              要求修改
            </Button>
          </div>
        </div>
      ) : (
        <span
          className={cn(
            "inline-flex text-[10px] px-2 py-0.5 rounded-full border font-medium",
            reviewStatusBadgeClass(status),
          )}
        >
          {REVIEW_STATUS_LABELS[status]}
        </span>
      )}

      {blocked ? (
        <p className="text-[10px] text-risk-high px-2 py-1.5 rounded-md bg-risk-high/10 border border-risk-high/20">
          存在阻断项，请先处理严重问题
        </p>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "APPROVE"
                ? "批准 PR"
                : dialogType === "REQUEST_CHANGES"
                  ? "要求修改"
                  : "发表评论"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入审批意见…"
            rows={4}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={submitting}>
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
