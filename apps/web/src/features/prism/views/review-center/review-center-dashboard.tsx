"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReviewCenterDashboard, ReviewStatus } from "@reviewly/shared"
import { AlertTriangle, ArrowRight, Bot, GitPullRequest, Loader2, UserCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ReviewPrList } from "@/features/prism/components/review-pr-list"
import type { WorkbenchNavigatePayload } from "@/features/prism/lib/review-center-navigation"
import { usePullRequests } from "@/hooks/use-pull-requests"
import { fetchReviewDashboard } from "@/lib/api/review-center"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { cn } from "@/lib/utils"

interface ReviewCenterDashboardViewProps {
  onNavigate: (payload: WorkbenchNavigatePayload) => void
  onNavigateFindings: () => void
  onSelectPr: (prId: string) => void
}

function SidebarKpi({
  label,
  value,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string
  value: number | string
  icon: typeof GitPullRequest
  accent?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-surface-2/50 text-left w-full",
        "hover:border-ai-blue/40 hover:bg-surface-2 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-blue/50",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn("w-3.5 h-3.5 shrink-0", accent ?? "text-muted-foreground")} />
        <span className="text-[11px] text-muted-foreground truncate">{label}</span>
      </div>
      <span className="text-sm font-semibold font-mono text-foreground shrink-0">{value}</span>
    </button>
  )
}

function StatusChip({
  label,
  value,
  onClick,
}: {
  label: string
  value: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-surface-2 text-[11px]",
        "hover:border-ai-blue/40 hover:bg-surface-3 transition-colors",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold text-foreground">{value}</span>
    </button>
  )
}

export function ReviewCenterDashboardView({
  onNavigate,
  onNavigateFindings,
  onSelectPr,
}: ReviewCenterDashboardViewProps) {
  const [data, setData] = useState<ReviewCenterDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { items, loading: prLoading, error: prError } = usePullRequests({
    includeExternal: "true",
    limit: "100",
    includeCounts: "false",
  })

  const pendingQueue = useMemo(() => {
    return items
      .filter((pr) => pr.reviewStatus === "OPEN" || pr.reviewStatus === "IN_REVIEW")
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .slice(0, 8)
  }, [items])

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    void fetchReviewDashboard(ac.signal)
      .then((result) => {
        if (!shouldApplyResult(ac.signal)) return
        setData(result)
        setError(null)
      })
      .catch((e) => {
        if (isAbortError(e) || !shouldApplyResult(ac.signal)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => {
        if (shouldApplyResult(ac.signal)) setLoading(false)
      })
    return () => ac.abort()
  }, [])

  const navigateAllWithStatus = (reviewStatus: ReviewStatus) => {
    onNavigate({ tab: "all", reviewStatus })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载工作台…
      </div>
    )
  }

  if (error || !data) {
    return <p className="py-12 text-center text-sm text-risk-high">{error ?? "暂无评审记录"}</p>
  }

  return (
    <div className="p-4 sm:p-5 h-full overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 lg:gap-5">
        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">待办队列</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                待评审与评审中的 PR
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-ai-blue shrink-0"
              onClick={() => onNavigate({ tab: "pending" })}
            >
              查看全部
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          <ReviewPrList
            items={pendingQueue}
            loading={prLoading}
            error={prError}
            compact
            showActions={false}
            onSelect={onSelectPr}
            emptyMessage="暂无评审记录。导入 Pull Request 后即可开始评审。"
          />
        </section>

        <aside className="space-y-4 min-w-0">
          <div>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              关键指标
            </h3>
            <div className="space-y-1.5">
              <SidebarKpi
                label="待我处理"
                value={data.pendingReview}
                icon={UserCheck}
                accent="text-ai-blue"
                onClick={() => onNavigate({ tab: "pending" })}
              />
              <SidebarKpi
                label="高风险 PR"
                value={data.highRisk}
                icon={AlertTriangle}
                accent="text-risk-high"
                onClick={() => onNavigate({ tab: "all", prFilter: "high-risk" })}
              />
              <SidebarKpi
                label="进行中"
                value={data.inReview}
                icon={GitPullRequest}
                accent="text-amber-300"
                onClick={() => onNavigate({ tab: "all", reviewStatus: "IN_REVIEW" })}
              />
              <SidebarKpi
                label="发现风险"
                value={data.aiFindingsThisWeek}
                icon={Bot}
                accent="text-ai-purple"
                onClick={onNavigateFindings}
              />
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              状态一览
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["OPEN", "待评审"],
                  ["IN_REVIEW", "评审中"],
                  ["CHANGES_REQUESTED", "待修改"],
                  ["APPROVED", "已通过"],
                  ["MERGED", "已合并"],
                ] as const
              ).map(([key, label]) => (
                <StatusChip
                  key={key}
                  label={label}
                  value={data.statusCounts[key] ?? 0}
                  onClick={() => navigateAllWithStatus(key)}
                />
              ))}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => onNavigate({ tab: "stats" })}
          >
            查看质量分析
          </Button>
        </aside>
      </div>
    </div>
  )
}
