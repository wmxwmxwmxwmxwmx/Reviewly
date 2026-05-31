"use client"

import type { ReactNode } from "react"
import { ExternalLink } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ReviewInboxItem } from "@/features/prism/types/review-task"
import { githubStateLabel } from "@/features/prism/types/review-task"
import { openGitHubReview } from "@/lib/github-pr-url"

function AttentionBadge({ state }: { state: ReviewInboxItem["attentionState"] }) {
  if (state === "unread") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-ai-blue font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-ai-blue" aria-hidden />
        未查阅
      </span>
    )
  }
  if (state === "needs_revisit") {
    return (
      <span className="text-[10px] text-risk-medium font-medium">⚠ 需要复查</span>
    )
  }
  return <span className="text-[10px] text-muted-foreground">已查阅</span>
}

type ReviewInboxCardListProps = {
  items: ReviewInboxItem[]
  loading?: boolean
  error?: string | null
  onSelect: (item: ReviewInboxItem) => void
  emptyMessage?: string
  emptyAction?: ReactNode
}

export function ReviewInboxCardList({
  items,
  loading,
  error,
  onSelect,
  emptyMessage = "暂无 PR",
  emptyAction,
}: ReviewInboxCardListProps) {
  if (loading) {
    return (
      <div className="divide-y divide-border rounded-lg border border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-3 py-3 animate-pulse">
            <div className="h-3 bg-surface-2 rounded w-1/3 mb-2" />
            <div className="h-4 bg-surface-2 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-risk-high py-4">{error}</p>
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        {emptyAction}
      </div>
    )
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border max-h-[calc(100vh-260px)] overflow-y-auto">
      {items.map((item, index) => (
        <article
          key={item.prId}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(item)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onSelect(item)
            }
          }}
          className="group relative px-3 py-2.5 hover:bg-surface-2/50 cursor-pointer transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ai-blue"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-ai-blue">#{index + 1}</span>
                <AttentionBadge state={item.attentionState} />
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                    item.riskLevel === "严重" || item.riskLevel === "高"
                      ? "border-risk-high/40 text-risk-high bg-risk-high/10"
                      : item.riskLevel === "中"
                        ? "border-amber-400/40 text-amber-400 bg-amber-400/10"
                        : "border-border text-muted-foreground bg-surface-2",
                  )}
                >
                  {item.riskLevel}
                </span>
                <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  {githubStateLabel(item.source.state)}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground truncate">{item.repo}</p>
              <p className="text-[13px] font-medium text-foreground truncate">{item.title}</p>

              <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2">
                <span>{item.author}</span>
                <span>·</span>
                <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
              </div>

              {item.aiSummary ? (
                <p className="text-[11px] text-muted-foreground line-clamp-2">{item.aiSummary}</p>
              ) : null}

              {item.attentionReasons.length > 0 ? (
                <p className="text-[11px] text-foreground/80">
                  {item.attentionReasons.join(" · ")}
                  {item.hasRealAi && item.advisoryAction ? (
                    <span className="text-ai-blue"> · {item.advisoryAction}</span>
                  ) : null}
                </p>
              ) : null}
            </div>

            <div
              className="flex flex-col gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="px-2.5 py-1 rounded text-[11px] font-medium bg-ai-blue/15 text-ai-blue hover:bg-ai-blue/25 whitespace-nowrap"
              >
                打开评审
              </button>
              <button
                type="button"
                onClick={() => openGitHubReview(item.source)}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-surface-2 text-muted-foreground hover:text-foreground whitespace-nowrap"
              >
                <ExternalLink className="w-3 h-3" />
                GitHub
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
