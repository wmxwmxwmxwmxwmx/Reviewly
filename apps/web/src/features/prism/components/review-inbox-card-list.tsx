"use client"

import type { ReactNode } from "react"
import { ExternalLink } from "lucide-react"

import { groupInboxItemsByRepo } from "@/features/prism/lib/group-inbox-by-repo"
import { cn } from "@/lib/utils"
import type { ReviewInboxItem } from "@/features/prism/types/review-task"
import { githubStateLabel } from "@/features/prism/types/review-task"
import { openGitHubReview } from "@/lib/github-pr-url"

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return "刚刚"
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return new Date(iso).toLocaleDateString()
}

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

function InboxCard({
  item,
  onSelect,
}: {
  item: ReviewInboxItem
  onSelect: (item: ReviewInboxItem) => void
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(item)
        }
      }}
      className="group relative px-3 py-2.5 hover:bg-surface-2/50 cursor-pointer transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ai-blue border-b border-border last:border-b-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm text-foreground truncate leading-snug">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.author} · {formatRelativeTime(item.updatedAt)}
          </p>
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
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
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openGitHubReview(item.source)
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-surface-2 text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          <ExternalLink className="w-3 h-3" />
          在 GitHub Review
        </button>
      </div>
    </article>
  )
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

  const groups = groupInboxItemsByRepo(items)

  return (
    <div className="rounded-lg border border-border max-h-[calc(100vh-220px)] overflow-y-auto">
      {groups.map((group) => (
        <section key={group.repo}>
          <div className="sticky top-0 z-10 px-3 py-2 border-b border-border bg-panel/95 backdrop-blur-sm">
            <p className="text-lg font-semibold font-mono text-foreground truncate">
              {group.repo}
            </p>
          </div>
          {group.items.map((item) => (
            <InboxCard key={item.prId} item={item} onSelect={onSelect} />
          ))}
        </section>
      ))}
    </div>
  )
}
