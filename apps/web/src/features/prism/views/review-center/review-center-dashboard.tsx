"use client"

import { useEffect, useState } from "react"
import type { ReviewCenterDashboard, ReviewStatus } from "@reviewly/shared"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  GitPullRequest,
  Loader2,
  UserCheck,
} from "lucide-react"
import { fetchReviewDashboard } from "@/lib/api/review-center"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import type { WorkbenchNavigatePayload } from "@/features/prism/lib/review-center-navigation"
import { cn } from "@/lib/utils"

interface ReviewCenterDashboardViewProps {
  onNavigate: (payload: WorkbenchNavigatePayload) => void
  onNavigateFindings: () => void
}

function MetricCard({
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
        "flex flex-col gap-3 p-4 rounded-lg border border-border bg-card text-left transition-colors",
        "hover:border-ai-blue/40 hover:bg-surface-2/80 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-blue/50",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <Icon className={cn("w-4 h-4", accent ?? "text-muted-foreground")} />
      </div>
      <div className="text-2xl font-semibold font-mono text-foreground">{value}</div>
    </button>
  )
}

function StatusBlock({
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
        "px-3 py-2 rounded-md bg-surface-2 border border-border text-left transition-colors",
        "hover:border-ai-blue/40 hover:bg-surface-3/80 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-blue/50",
      )}
    >
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-lg font-mono font-semibold">{value}</div>
    </button>
  )
}

export function ReviewCenterDashboardView({
  onNavigate,
  onNavigateFindings,
}: ReviewCenterDashboardViewProps) {
  const [data, setData] = useState<ReviewCenterDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const isEmpty =
    data.pendingReview === 0 &&
    data.inReview === 0 &&
    data.myCreated === 0 &&
    data.highRisk === 0 &&
    (data.statusCounts.ALL ?? 0) === 0

  return (
    <div className="p-5 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">工作台</h2>
        <p className="text-[12px] text-muted-foreground mt-1">团队 PR 评审概览与待办事项</p>
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2/40 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">暂无评审记录</p>
          <p className="text-xs text-muted-foreground/80 mt-1">导入 Pull Request 后即可开始评审</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <MetricCard
          label="待我处理"
          value={data.pendingReview}
          icon={UserCheck}
          accent="text-ai-blue"
          onClick={() => onNavigate({ tab: "pending" })}
        />
        <MetricCard
          label="进行中 PR"
          value={data.inReview}
          icon={GitPullRequest}
          accent="text-amber-300"
          onClick={() => onNavigate({ tab: "all", reviewStatus: "IN_REVIEW" })}
        />
        <MetricCard
          label="我创建的 PR"
          value={data.myCreated}
          icon={GitPullRequest}
          onClick={() => onNavigate({ tab: "all", prFilter: "my-created" })}
        />
        <MetricCard
          label="高风险 PR"
          value={data.highRisk}
          icon={AlertTriangle}
          accent="text-risk-high"
          onClick={() => onNavigate({ tab: "all", prFilter: "high-risk" })}
        />
        <MetricCard
          label="本周评审数量"
          value={data.weeklyApprovals}
          icon={CheckCircle2}
          accent="text-risk-low"
          onClick={() => onNavigate({ tab: "stats" })}
        />
        <MetricCard
          label="发现风险"
          value={data.aiFindingsThisWeek}
          icon={Bot}
          accent="text-ai-purple"
          onClick={onNavigateFindings}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">状态分布</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {(
            [
              ["OPEN", "待评审"],
              ["IN_REVIEW", "评审中"],
              ["CHANGES_REQUESTED", "待修改"],
              ["APPROVED", "已通过"],
              ["MERGED", "已合并"],
            ] as const
          ).map(([key, label]) => (
            <StatusBlock
              key={key}
              label={label}
              value={data.statusCounts[key] ?? 0}
              onClick={() => navigateAllWithStatus(key)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
