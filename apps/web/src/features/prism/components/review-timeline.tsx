"use client"

import { useEffect, useState } from "react"
import type { ReviewTimelineEvent } from "@reviewly/shared"
import { Bot, GitPullRequest, Loader2, MessageSquare, User } from "lucide-react"

import { fetchReviewTimeline } from "@/lib/api/review-center"
import { cn } from "@/lib/utils"

const EVENT_LABELS: Record<string, string> = {
  PR_CREATED: "创建 PR",
  AI_ANALYSIS_COMPLETE: "AI 完成分析",
  AI_SUMMARY_SAVED: "AI 重新分析",
  COMMENT: "发表评论",
  APPROVED: "批准 PR",
  CHANGES_REQUESTED: "要求修改",
  MERGED: "PR 已合并",
}

function eventIcon(event: ReviewTimelineEvent) {
  if (event.actorType === "ai") return Bot
  if (event.eventType === "COMMENT") return MessageSquare
  if (event.eventType === "PR_CREATED") return GitPullRequest
  return User
}

interface ReviewTimelineProps {
  prId: string
  refreshKey?: number
}

export function ReviewTimeline({ prId, refreshKey = 0 }: ReviewTimelineProps) {
  const [items, setItems] = useState<ReviewTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    void fetchReviewTimeline(prId, ac.signal)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [prId, refreshKey])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-[11px] text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        加载评审历史…
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="text-[11px] text-muted-foreground py-2">暂无评审历史</p>
  }

  return (
    <div className="space-y-0">
      {items.map((event, index) => {
        const Icon = eventIcon(event)
        const label = EVENT_LABELS[event.eventType] ?? event.eventType
        return (
          <div key={event.id} className="flex gap-3 pb-4 relative">
            {index < items.length - 1 ? (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
            ) : null}
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 border",
                event.actorType === "ai"
                  ? "bg-ai-purple/15 border-ai-purple/30 text-ai-purple"
                  : "bg-surface-2 border-border text-muted-foreground",
              )}
            >
              <Icon className="w-3 h-3" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-[11px] text-foreground">
                <span className="font-medium">{event.actor}</span>
                <span className="text-muted-foreground mx-1">{label}</span>
              </div>
              {event.content ? (
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                  {event.content}
                </p>
              ) : null}
              <time className="text-[9px] text-muted-foreground/70 font-mono">
                {new Date(event.createdAt).toLocaleString("zh-CN")}
              </time>
            </div>
          </div>
        )
      })}
    </div>
  )
}
