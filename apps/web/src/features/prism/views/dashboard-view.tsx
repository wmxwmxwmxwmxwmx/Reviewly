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
  Database,
  Timer,
  DollarSign,
  ChevronRight,
  FolderGit2,
} from "lucide-react"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import type { NavView } from "@/features/prism/components/sidebar"
import { useDashboardContext } from "@/features/prism/contexts/dashboard-context"
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics"
import { useRiskDistribution } from "@/hooks/use-risk-distribution"
import { useWeeklySummary } from "@/hooks/use-weekly-summary"

function activityIconType(type: string) {
  return type.includes("security") || type === "security_finding"
}

export function DashboardView() {
  const { navigate } = useNavigation()
  const { data: dashboard, loading, error, refetch, isValidating } = useDashboardContext()
  const metrics = useDashboardMetrics(dashboard, loading)
  const { segments: riskSegments, total: riskTotal } = useRiskDistribution(dashboard)
  const { content: weeklyContent, loading: weeklyLoading, error: weeklyError, generate } =
    useWeeklySummary(dashboard, refetch)

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
      const target: NavView = type.includes("security") || type.includes("performance")
        ? "findings"
        : type.includes("pr-opened") || type.includes("pr-merged")
          ? "repos"
          : "ai-review"
      return {
        severity,
        message: `${activity.user} ${activity.action}（${activity.repo}）`,
        action: "查看详情",
        target,
        pullRequestId: activity.pullRequestId,
        findingsTab:
          type.includes("performance")
            ? ("performance" as const)
            : type.includes("security")
              ? ("security" as const)
              : undefined,
      }
    })
  }, [activities])

  const navigateFromInsight = (
    target: NavView,
    pullRequestId?: string,
    findingsTab?: "security" | "performance",
  ) => {
    if (pullRequestId && target === "ai-review") {
      navigate(target, { prId: pullRequestId })
      return
    }
    if (target === "findings") {
      navigate("findings", { tab: findingsTab ?? "security" })
      return
    }
    navigate(target)
  }

  const recentReviews = dashboard?.recentReviews ?? []

  const topRepos = dashboard?.topRepos ?? []
  const analysisCache = dashboard?.analysisCache

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{zh.nav.dashboard}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.dashboard}</p>
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

      {analysisCache && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              icon: Database,
              label: "缓存命中率",
              value: `${analysisCache.hitRate}%`,
              color: "text-ai-blue",
            },
            {
              icon: Timer,
              label: "节省分析时间",
              value: analysisCache.savedTimeLabel,
              color: "text-risk-low",
            },
            {
              icon: DollarSign,
              label: "预估节省 AI 成本",
              value: `$${analysisCache.estimatedCostSavedUsd.toFixed(2)}`,
              color: "text-ai-purple",
            },
          ].map((card, idx) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 rounded-lg bg-surface-2 border border-border"
            >
              <card.icon className={cn("w-5 h-5 mb-2", card.color)} />
              <div className="text-2xl font-semibold text-foreground">{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
            </motion.div>
          ))}
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
                        (activity.user ?? "?").slice(0, 2)
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
            <span className="text-sm font-medium text-foreground">{zh.dashboard.repoOverview}</span>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="px-4 py-3">
                  <Skeleton className="h-10 w-full" />
                </div>
              ))
            ) : topRepos.length === 0 ? (
              <div className="px-4 py-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">{zh.dashboard.noReposHint}</p>
                <button
                  type="button"
                  onClick={() => navigate("repos")}
                  className="text-xs text-ai-blue hover:underline"
                >
                  {zh.dashboard.goToRepos}
                </button>
              </div>
            ) : (
              topRepos.map((repo, idx) => (
                <motion.button
                  key={repo.id}
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate("repos", { repoId: repo.id })}
                  className="w-full px-4 py-3 text-left hover:bg-surface-2/80 transition-colors flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-md bg-ai-blue/10 border border-ai-blue/20 flex items-center justify-center shrink-0">
                    <FolderGit2 className="w-4 h-4 text-ai-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground font-mono truncate">
                      {repo.fullName ?? repo.name}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <GitPullRequest className="w-3 h-3" />
                        {zh.dashboard.repoPrCount(repo.prs)}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {repo.issues} 问题
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-ai-blue shrink-0 transition-colors" />
                </motion.button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">{zh.dashboard.recentActivity}</span>
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
                  onClick={() =>
                    navigateFromInsight(
                      insight.target,
                      insight.pullRequestId,
                      insight.findingsTab,
                    )
                  }
                  className="text-xs text-ai-blue hover:underline"
                >
                  {insight.action}
                </button>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {recentReviews.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">最近评审</span>
          </div>
          <div className="divide-y divide-border">
            {recentReviews.slice(0, 3).map((review) => (
              <button
                key={review.jobId}
                type="button"
                onClick={() => navigate("ai-review", { prId: review.pullRequestId })}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface-2/80 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{review.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    风险分 {review.riskScore} · {review.mergeRecommendation}
                  </div>
                </div>
                <span className="text-xs text-ai-blue shrink-0">查看</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
