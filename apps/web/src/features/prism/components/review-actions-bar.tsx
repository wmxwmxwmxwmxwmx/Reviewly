"use client"

import { useCallback, useEffect, useState } from "react"
import type { ApprovalCheckResult, ReviewComment, ReviewCommentType } from "@reviewly/shared"
import { CheckCircle2, MessageSquare, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchApprovalCheck,
  fetchReviewComments,
  postReviewComment,
} from "@/lib/api/review-center"
import { PrismApiError } from "@/lib/api/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface ReviewActionsBarProps {
  prId: string
  onUpdated?: () => void
}

export function ReviewActionsBar({ prId, onUpdated }: ReviewActionsBarProps) {
  const { toast } = useToast()
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [approvalCheck, setApprovalCheck] = useState<ApprovalCheckResult | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<ReviewCommentType>("COMMENT")
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)

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

  const openDialog = (type: ReviewCommentType) => {
    setDialogType(type)
    setContent("")
    setDialogOpen(true)
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      await postReviewComment(prId, { type: dialogType, content })
      toast({ title: dialogType === "APPROVE" ? "已批准" : dialogType === "REQUEST_CHANGES" ? "已要求修改" : "评论已提交" })
      setDialogOpen(false)
      reload()
      onUpdated?.()
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
  const lastApproval = [...comments].reverse().find((c) => c.type === "APPROVE")
  const lastReject = [...comments].reverse().find((c) => c.type === "REQUEST_CHANGES")

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">人工审批</h3>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {lastApproval ? <span className="text-risk-low">{lastApproval.userName} 已批准</span> : null}
          {lastReject ? <span className="text-risk-high">{lastReject.userName} 要求修改</span> : null}
        </div>
      </div>

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

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => openDialog("COMMENT")}>
          <MessageSquare className="w-3.5 h-3.5" />
          评论
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={blocked}
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
          onClick={() => openDialog("REQUEST_CHANGES")}
        >
          <XCircle className="w-3.5 h-3.5 text-risk-high" />
          要求修改
        </Button>
      </div>

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
