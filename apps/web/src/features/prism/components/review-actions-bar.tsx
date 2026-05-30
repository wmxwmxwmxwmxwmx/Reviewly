/**
 * @deprecated Prefer ReviewInsightPanel + ReviewDecisionBar in ai-review-view.
 * Still exported for compatibility; new PR review UI should not import this component.
 */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type {
  AnalysisFinding,
  AnalysisSummary,
  ApprovalCheckResult,
  ReviewComment,
  ReviewCommentType,
  ReviewStatus,
} from "@reviewly/shared"
import { Bot, CheckCircle2, MessageSquare, PlayCircle, XCircle } from "lucide-react"

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
import { buildAiReviewerOpinion } from "@/lib/ai/ai-reviewer-opinion"
import { PrismApiError } from "@/lib/api/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const MANUAL_STATUSES: ReviewStatus[] = [
  "OPEN",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
]

interface ReviewActionsBarProps {
  prId: string
  reviewStatus?: ReviewStatus
  findings?: AnalysisFinding[]
  latest?: AnalysisSummary | null
  prTitle?: string
  repoLabel?: string
  prNumber?: number
  aiSummary?: string
  hasCompletedAnalysis?: boolean
  fallbackScores?: {
    riskScore?: number
    securityScore?: number
    performanceScore?: number
    maintainabilityScore?: number
  }
  onScrollToAiSummary?: () => void
  onUpdated?: () => void
  onStatusChange?: (status: ReviewStatus) => void
}

export function ReviewActionsBar({
  prId,
  reviewStatus = "OPEN",
  findings = [],
  latest,
  prTitle,
  repoLabel,
  prNumber,
  aiSummary,
  hasCompletedAnalysis,
  fallbackScores,
  onScrollToAiSummary,
  onUpdated,
  onStatusChange,
}: ReviewActionsBarProps) {
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

  const startReview = () => void changeStatus("IN_REVIEW")

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
  const lastApproval = [...comments].reverse().find((c) => c.type === "APPROVE")
  const lastReject = [...comments].reverse().find((c) => c.type === "REQUEST_CHANGES")

  const aiOpinion = useMemo(
    () =>
      buildAiReviewerOpinion({
        findings,
        latest,
        prTitle,
        repoLabel,
        prNumber,
        fallbackScores,
        aiSummary,
        hasCompletedAnalysis,
      }),
    [
      findings,
      latest,
      prTitle,
      repoLabel,
      prNumber,
      fallbackScores,
      aiSummary,
      hasCompletedAnalysis,
    ],
  )

  const canJumpToSummary = Boolean(onScrollToAiSummary && (aiSummary?.trim() || latest?.summary))

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground">人工审批</h3>
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border font-medium",
              reviewStatusBadgeClass(status),
            )}
          >
            {REVIEW_STATUS_LABELS[status]}
          </span>
          <button
            type="button"
            disabled={!canJumpToSummary}
            onClick={() => onScrollToAiSummary?.()}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors",
              aiOpinion.suggestChanges
                ? "bg-risk-high/15 text-risk-high border-risk-high/30"
                : aiOpinion.verdict === "pending"
                  ? "bg-surface-3 text-muted-foreground border-border"
                  : "bg-risk-low/15 text-risk-low border-risk-low/30",
              canJumpToSummary && "hover:brightness-110 cursor-pointer",
              !canJumpToSummary && "opacity-70 cursor-default",
            )}
            title={canJumpToSummary ? "查看下方 AI 摘要报告" : "完成分析后将与 AI 摘要报告同步"}
          >
            <Bot className="w-3 h-3" />
            AI 建议：{aiOpinion.verdictLabel}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {lastApproval ? <span className="text-risk-low">{lastApproval.userName} 已批准</span> : null}
          {lastReject ? <span className="text-risk-high">{lastReject.userName} 要求修改</span> : null}
        </div>
      </div>

      {!terminal ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-muted-foreground shrink-0">调整状态</span>
          <Select
            value={status}
            onValueChange={(v) => void changeStatus(v as ReviewStatus)}
            disabled={statusUpdating}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
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
          {status === "OPEN" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={statusUpdating}
              onClick={startReview}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              开始评审
            </Button>
          ) : null}
        </div>
      ) : null}

      {blocked ? (
        <div className="px-3 py-2 rounded-md bg-risk-high/10 border border-risk-high/25 text-[11px] text-risk-high">
          当前 PR 存在严重风险，请修复后重新提交
          {approvalCheck?.reasons?.length ? (
            <ul className="mt-1 list-disc list-inside opacity-90">
              {approvalCheck.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!terminal ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => openDialog("COMMENT")}>
            <MessageSquare className="w-3.5 h-3.5" />
            评论
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={blocked || statusUpdating}
            className={cn(blocked && "opacity-50 cursor-not-allowed")}
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
            onClick={() => openDialog("REQUEST_CHANGES")}
          >
            <XCircle className="w-3.5 h-3.5 text-risk-high" />
            要求修改
          </Button>
        </div>
      ) : null}

      {comments.length > 0 ? (
        <div className="space-y-2 max-h-40 overflow-y-auto pt-2 border-t border-border">
          {comments.slice(-5).map((c) => (
            <div key={c.id} className="text-[11px]">
              <span className="font-medium text-foreground">{c.userName}</span>
              <span className="text-muted-foreground mx-1">·</span>
              <span className="text-muted-foreground">{c.content}</span>
            </div>
          ))}
        </div>
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
