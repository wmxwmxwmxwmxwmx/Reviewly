"use client"

import { useMemo } from "react"
import { Clock, GitPullRequest, Shield } from "lucide-react"

import type { DashboardStats } from "@reviewly/shared"

export interface DashboardMetricCard {
  icon: typeof GitPullRequest
  label: string
  value: string
  suffix?: string
  change: string
  trend: "up" | "down"
  color: string
}

export function useDashboardMetrics(dashboard: DashboardStats | null, loading: boolean) {
  return useMemo((): DashboardMetricCard[] => {
    if (!dashboard && loading) {
      return []
    }
    const d = dashboard
    const summary = d?.summary
    const pending = summary?.openPrCount ?? d?.pendingPrs ?? 0
    const security = summary?.securityCount ?? d?.securityIssues ?? 0
    const performance = summary?.performanceCount ?? 0
    const openRisks = security + performance
    const highRisk = summary?.highRiskCount ?? 0
    const avgMs = d?.analysisTiming?.avgDurationMs ?? 0
    const avgHours =
      d?.avgReviewHours ?? (avgMs > 0 ? Math.round((avgMs / 3_600_000) * 10) / 10 : 0)
    const runningAi = d?.runningTasks?.aiReview ?? 0

    return [
      {
        icon: GitPullRequest,
        label: "待评审 PR",
        value: String(pending),
        change: highRisk > 0 ? `${highRisk} 高风险` : "—",
        trend: "up",
        color: "text-ai-blue",
      },
      {
        icon: Shield,
        label: "开放风险",
        value: String(openRisks),
        change:
          security > 0 || performance > 0
            ? `${security} 安全 · ${performance} 性能`
            : "—",
        trend: openRisks > 0 ? "up" : "down",
        color: "text-risk-high",
      },
      {
        icon: Shield,
        label: "分析任务",
        value: String(d?.analysisTiming?.completedCount ?? runningAi),
        change: runningAi > 0 ? `${runningAi} 进行中` : "—",
        trend: runningAi > 0 ? "up" : "down",
        color: "text-ai-purple",
      },
      {
        icon: Clock,
        label: "平均分析耗时",
        value: avgHours > 0 ? String(avgHours) : "—",
        suffix: avgHours > 0 ? "h" : undefined,
        change:
          d?.analysisTiming?.completedCount != null
            ? `${d.analysisTiming.completedCount} 次完成`
            : "—",
        trend: "down",
        color: "text-foreground",
      },
    ]
  }, [dashboard, loading])
}
