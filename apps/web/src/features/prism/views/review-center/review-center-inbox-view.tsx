"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import type { PullRequestListItem } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import { ReviewPrList, ReviewPrListSection } from "@/features/prism/components/review-pr-list"
import { usePullRequests } from "@/hooks/use-pull-requests"
import { useToast } from "@/hooks/use-toast"
import { patchReviewStatus } from "@/lib/api/review-center"
import { PrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"

const DISMISS_KEY = "prism:inbox-dismissed"

function readDismissed(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set()
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY)
    if (!raw) return new Set()
    const ids = JSON.parse(raw) as string[]
    return new Set(ids)
  } catch {
    return new Set()
  }
}

function writeDismissed(ids: Set<string>) {
  sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]))
}

function riskRank(level: PullRequestListItem["riskLevel"]) {
  if (level === "critical") return 0
  if (level === "high") return 1
  if (level === "medium") return 2
  return 3
}

function sortInboxItems(items: PullRequestListItem[]) {
  return [...items].sort((a, b) => {
    const riskDiff = riskRank(a.riskLevel) - riskRank(b.riskLevel)
    if (riskDiff !== 0) return riskDiff
    const aNeedsAi = a.aiSummary?.content ? 1 : 0
    const bNeedsAi = b.aiSummary?.content ? 1 : 0
    if (aNeedsAi !== bNeedsAi) return aNeedsAi - bNeedsAi
    return (b.updatedAt || "").localeCompare(a.updatedAt || "")
  })
}

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
  const { toast } = useToast()
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed())

  const { items, loading, error, reload } = usePullRequests({
    includeExternal: "true",
    limit: "100",
    includeCounts: "false",
  })

  useEffect(() => {
    if (reloadToken > 0) reload()
  }, [reloadToken, reload])

  const inboxItems = useMemo(() => {
    const actionable = items.filter(
      (pr) =>
        !dismissed.has(pr.id) &&
        (pr.reviewStatus === "OPEN" ||
          pr.reviewStatus === "IN_REVIEW" ||
          pr.reviewStatus === "CHANGES_REQUESTED"),
    )
    return sortInboxItems(actionable)
  }, [items, dismissed])

  const needsReview = useMemo(
    () => inboxItems.filter((pr) => pr.reviewStatus === "OPEN" || pr.reviewStatus === "CHANGES_REQUESTED"),
    [inboxItems],
  )
  const inReview = useMemo(
    () => inboxItems.filter((pr) => pr.reviewStatus === "IN_REVIEW"),
    [inboxItems],
  )

  const handleDismiss = useCallback((pr: PullRequestListItem) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(pr.id)
      writeDismissed(next)
      return next
    })
  }, [])

  const handleApprove = useCallback(
    async (pr: PullRequestListItem) => {
      try {
        await patchReviewStatus(pr.id, "APPROVED")
        reload()
      } catch (e) {
        toast({
          title: "批准失败",
          description: e instanceof PrismApiError ? e.message : undefined,
          variant: "destructive",
        })
      }
    },
    [reload, toast],
  )

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

  const listProps = {
    loading,
    error,
    compact: true,
    variant: "linear" as const,
    showActions: false,
    showQuickActions: true,
    onSelect: onSelectPr,
    onApprove: (pr: PullRequestListItem) => void handleApprove(pr),
    onDismiss: handleDismiss,
    emptyMessage: "Inbox 为空 — 导入 PR 或等待新的评审任务。",
    emptyAction,
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Inbox</h2>
        <span className="text-xs text-muted-foreground font-mono">
          {loading ? "…" : `${inboxItems.length} 待处理`}
        </span>
      </div>

      {!loading && !error && inboxItems.length === 0 ? (
        <ReviewPrList items={[]} {...listProps} />
      ) : loading || error ? (
        <ReviewPrList items={[]} {...listProps} />
      ) : (
        <div className="space-y-4">
          <ReviewPrListSection title="Needs review" items={needsReview} {...listProps} />
          <ReviewPrListSection title="In review" items={inReview} {...listProps} />
        </div>
      )}
    </div>
  )
}
