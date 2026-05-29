"use client"

import { useMemo } from "react"
import { Clock, Gauge, GitPullRequest, Shield } from "lucide-react"

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
    const highRisk = summary?.highRiskCount ?? 0
    const performance = summary?.performanceCount ?? 0
    const avgMs = d?.analysisTiming?.avgDurationMs ?? 0
    const avgHours =
      d?.avgReviewHours ?? (avgMs > 0 ? Math.round((avgMs / 3_600_000) * 10) / 10 : 0)

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
        label: "安全问题",
        value: String(security),
        change: security > 0 ? "需关注" : "—",
        trend: security > 0 ? "up" : "down",
        color: "text-risk-high",
      },
      {
        icon: Gauge,
        label: "代码质量",
        value: String(d?.qualityScore ?? "—"),
        suffix: "/100",
        change: performance > 0 ? `${performance} 性能` : "—",
        trend: "up",
        color: "text-risk-low",
      },
      {
        icon: Clock,
        label: "平均分析耗时",
        value: avgHours > 0 ? String(avgHours) : "—",
        suffix: avgHours > 0 ? "h" : undefined,
        change:
          d?.analysisTiming?.completedCount != null
            ? `${d.analysisTiming.completedCount} 次`
            : "—",
        trend: "down",
        color: "text-foreground",
      },
    ]
  }, [dashboard, loading])
}
