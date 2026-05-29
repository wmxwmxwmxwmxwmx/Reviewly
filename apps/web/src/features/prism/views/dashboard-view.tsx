"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  GitPullRequest,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle2,
  BrainCircuit,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import type { NavView } from "@/features/prism/components/sidebar"
import { useDashboard } from "@/hooks/use-dashboard"
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics"
import { useRiskDistribution } from "@/hooks/use-risk-distribution"
import { useWeeklySummary } from "@/hooks/use-weekly-summary"

function activityIconType(type: string) {
  return type.includes("security") || type === "security_finding"
}

export function DashboardView() {
  const { navigate } = useNavigation()
  const { data: dashboard, loading, error, refetch, isValidating } = useDashboard()
  const metrics = useDashboardMetrics(dashboard, loading)
  const { segments: riskSegments, total: riskTotal } = useRiskDistribution(dashboard)
  const { content: weeklyContent, loading: weeklyLoading, error: weeklyError, generate } =
    useWeeklySummary()

  const activities = dashboard?.activities?.length
    ? dashboard.activities
    : dashboard?.recentActivity ?? []

  const resolvedAiInsights = useMemo(() => {
    if (!activities.length) return []
    return activities.slice(0, 3).map((activity) => {
      const type = activity.type
      const severity = type.includes("security")
        ? "high"
        : type.includes("review") || type.includes("analysis")
          ? "medium"
          : "low"
      const target: NavView = type.includes("security")
        ? "security"
        : type.includes("pr-opened") || type.includes("pr-merged")
          ? "pull-requests"
          : "ai-review"
      return {
        severity,
        message: `${activity.user} ${activity.action}（${activity.repo}）`,
        action: "查看详情",
        target,
      }
    })
  }, [activities])

  const topRepos = dashboard?.topRepos ?? []

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">总览面板</h1>
          <p className="text-sm text-muted-foreground mt-0.5">查看项目健康状况和关键指标</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isValidating && "animate-spin")} />
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-risk-high/30 bg-risk-high/10 px-4 py-3 text-sm text-risk-high flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => refetch()} className="text-xs underline">
            重试
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading && metrics.length === 0
          ? Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-surface-2 border border-border space-y-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          : metrics.map((metric, idx) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-lg bg-surface-2 border border-border"
              >
                <div className="flex items-center justify-between">
                  <metric.icon className={cn("w-5 h-5", metric.color)} />
                  <div
                    className={cn(
                      "flex items-center gap-1 text-xs text-muted-foreground",
                      metric.trend === "up" && metric.label === "安全问题"
                        ? "text-risk-high"
                        : metric.trend === "down"
                          ? "text-risk-low"
                          : ""
                    )}
                  >
                    {metric.trend === "up" ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {metric.change}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-foreground">{metric.value}</span>
                    {metric.suffix && (
                      <span className="text-sm text-muted-foreground">{metric.suffix}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{metric.label}</div>
                </div>
              </motion.div>
            ))}
      </div>

      {riskTotal > 0 && (
        <div className="rounded-lg border border-border p-4 bg-surface-2">
          <p className="text-sm font-medium text-foreground mb-3">{zh.dashboard.riskDistributionOpenPr}</p>
          <div className="flex h-2 rounded-full overflow-hidden bg-surface-3">
            {riskSegments.map((seg) => (
              <div
                key={seg.key}
                className={cn("h-full", seg.colorClass)}
                style={{ width: `${seg.percent}%` }}
                title={`${seg.label}: ${seg.count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            {riskSegments.map((seg) => (
              <span key={seg.key}>
                {seg.label} {seg.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <Activity className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">最近活动</span>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="px-4 py-3 flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : activities.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">暂无活动记录</p>
            ) : (
              activities.map((activity, idx) => (
                <motion.div
                  key={`${activity.time}-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="px-4 py-3 hover:bg-surface-2/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold",
                        activityIconType(activity.type)
                          ? "bg-[oklch(0.62_0.19_240/0.2)] text-ai-blue"
                          : "bg-gradient-to-br from-[oklch(0.55_0.19_240)] to-[oklch(0.45_0.14_264)] text-white"
                      )}
                    >
                      {activityIconType(activity.type) ? (
                        <BrainCircuit className="w-4 h-4" />
                      ) : (
                        activity.user.slice(0, 2)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground">
                        <span className="font-medium">{activity.user}</span>
                        <span className="text-muted-foreground"> {activity.action}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono">{activity.repo}</span>
                        <span className="mx-2">·</span>
                        <span>{activity.time}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">仓库健康度</span>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="px-4 py-3 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-1.5 w-full" />
                </div>
              ))
            ) : topRepos.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">暂无仓库数据</p>
            ) : (
              topRepos.map((repo, idx) => (
                <motion.div
                  key={repo.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground font-mono">{repo.name}</span>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        repo.health >= 85
                          ? "text-risk-low"
                          : repo.health >= 70
                            ? "text-risk-medium"
                            : "text-risk-high"
                      )}
                    >
                      {repo.health}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GitPullRequest className="w-3 h-3" />
                      {zh.dashboard.repoPrCount(repo.prs)}
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {repo.issues} 问题
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        repo.health >= 85
                          ? "bg-risk-low"
                          : repo.health >= 70
                            ? "bg-risk-medium"
                            : "bg-risk-high"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${repo.health}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.1 }}
                    />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">AI 洞察</span>
          </div>
          <button
            type="button"
            onClick={() => generate()}
            disabled={weeklyLoading}
            className="text-xs px-2.5 py-1 rounded-md bg-ai-blue/15 text-ai-blue hover:bg-ai-blue/25 disabled:opacity-50 flex items-center gap-1"
          >
            {weeklyLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            {zh.actions.generateWeeklySummary}
          </button>
        </div>
        {weeklyError && (
          <p className="px-4 py-2 text-xs text-risk-high border-b border-border">{weeklyError}</p>
        )}
        {weeklyContent && (
          <div className="px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap border-b border-border">
            {weeklyContent}
          </div>
        )}
        <div className="divide-y divide-border">
          {resolvedAiInsights.length === 0 && !weeklyContent && !loading ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">{zh.dashboard.aiInsightsEmpty}</p>
          ) : (
            resolvedAiInsights.map((insight, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="px-4 py-3 flex items-center gap-3"
              >
                <div
                  className={cn(
                    "p-1.5 rounded",
                    insight.severity === "high"
                      ? "bg-[oklch(0.62_0.21_32/0.15)]"
                      : insight.severity === "medium"
                        ? "bg-[oklch(0.75_0.15_85/0.15)]"
                        : "bg-surface-3"
                  )}
                >
                  {insight.severity === "high" ? (
                    <AlertTriangle className="w-4 h-4 text-risk-high" />
                  ) : insight.severity === "medium" ? (
                    <AlertTriangle className="w-4 h-4 text-risk-medium" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <span className="flex-1 text-sm text-muted-foreground">{insight.message}</span>
                <button
                  type="button"
                  onClick={() => navigate(insight.target)}
                  className="text-xs text-ai-blue hover:underline"
                >
                  {insight.action}
                </button>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
