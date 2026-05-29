"use client"

import { motion } from "framer-motion"
import {
  LayoutDashboard,
  GitPullRequest,
  Shield,
  Gauge,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  BrainCircuit,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import type { NavView } from "@/features/prism/components/sidebar"

const metrics = [
  { icon: GitPullRequest, label: "待评审 PR", value: "12", change: "+3", trend: "up", color: "text-ai-blue" },
  { icon: Shield, label: "安全问题", value: "5", change: "-2", trend: "down", color: "text-risk-high" },
  { icon: Gauge, label: "代码质量", value: "87", suffix: "/100", change: "+5", trend: "up", color: "text-risk-low" },
  { icon: Clock, label: "平均评审时间", value: "2.4", suffix: "h", change: "-0.8", trend: "down", color: "text-foreground" },
]

const recentActivity = [
  { type: "pr-merged", user: "张维", action: "合并了 PR #1838", repo: "prism-core", time: "10 分钟前" },
  { type: "review", user: "李明", action: "完成了代码评审", repo: "auth-service", time: "25 分钟前" },
  { type: "security", user: "AI", action: "发现 SQL 注入漏洞", repo: "api-gateway", time: "1 小时前" },
  { type: "pr-opened", user: "王芳", action: "创建了 PR #1842", repo: "order-module", time: "2 小时前" },
  { type: "comment", user: "陈浩", action: "评论了 PR #1841", repo: "prism-core", time: "3 小时前" },
]

const topRepos = [
  { name: "prism-core", prs: 8, issues: 3, health: 92 },
  { name: "auth-service", prs: 4, issues: 1, health: 88 },
  { name: "api-gateway", prs: 6, issues: 5, health: 72 },
  { name: "order-module", prs: 3, issues: 2, health: 85 },
]

const aiInsights: { severity: string; message: string; action: string; target: NavView }[] = [
  { severity: "high", message: "api-gateway 仓库安全评分下降 15%，建议优先处理", action: "查看详情", target: "security" },
  { severity: "medium", message: "本周代码评审平均时间增加，考虑分配更多评审资源", action: "查看分析", target: "pull-requests" },
  { severity: "low", message: "order-module 重构 PR 变更量较大，建议拆分评审", action: "查看 PR", target: "ai-review" },
]

export function DashboardView() {
  const { navigate } = useNavigation()

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">总览面板</h1>
        <p className="text-sm text-muted-foreground mt-0.5">查看项目健康状况和关键指标</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((metric, idx) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-4 rounded-lg bg-surface-2 border border-border"
          >
            <div className="flex items-center justify-between">
              <metric.icon className={cn("w-5 h-5", metric.color)} />
              <div className={cn(
                "flex items-center gap-1 text-xs",
                metric.trend === "up" && metric.label !== "安全问题" ? "text-risk-low" : 
                metric.trend === "down" && metric.label === "安全问题" ? "text-risk-low" : 
                metric.trend === "down" ? "text-risk-low" : "text-risk-high"
              )}>
                {metric.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {metric.change}
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-foreground">{metric.value}</span>
                {metric.suffix && <span className="text-sm text-muted-foreground">{metric.suffix}</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{metric.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <Activity className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">最近活动</span>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.map((activity, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="px-4 py-3 hover:bg-surface-2/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold",
                    activity.type === "security" 
                      ? "bg-[oklch(0.62_0.19_240/0.2)] text-ai-blue" 
                      : "bg-gradient-to-br from-[oklch(0.55_0.19_240)] to-[oklch(0.45_0.14_264)] text-white"
                  )}>
                    {activity.type === "security" ? <BrainCircuit className="w-4 h-4" /> : activity.user.slice(0, 2)}
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
            ))}
          </div>
        </div>

        {/* Top Repos */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">仓库健康度</span>
          </div>
          <div className="divide-y divide-border">
            {topRepos.map((repo, idx) => (
              <motion.div
                key={repo.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground font-mono">{repo.name}</span>
                  <span className={cn(
                    "text-xs font-medium",
                    repo.health >= 85 ? "text-risk-low" : repo.health >= 70 ? "text-risk-medium" : "text-risk-high"
                  )}>
                    {repo.health}%
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GitPullRequest className="w-3 h-3" />
                    {repo.prs} PRs
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
                      repo.health >= 85 ? "bg-risk-low" : repo.health >= 70 ? "bg-risk-medium" : "bg-risk-high"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${repo.health}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.1 }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">AI 洞察</span>
        </div>
        <div className="divide-y divide-border">
          {aiInsights.map((insight, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="px-4 py-3 flex items-center gap-3"
            >
              <div className={cn(
                "p-1.5 rounded",
                insight.severity === "high" ? "bg-[oklch(0.62_0.21_32/0.15)]" :
                insight.severity === "medium" ? "bg-[oklch(0.75_0.15_85/0.15)]" : "bg-surface-3"
              )}>
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
          ))}
        </div>
      </div>
    </div>
  )
}
