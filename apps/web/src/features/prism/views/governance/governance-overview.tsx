"use client"

import {
  AlertTriangle,
  GitPullRequest,
  Shield,
  ShieldAlert,
  Target,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import type { GovernanceOverviewMetrics } from "@/hooks/use-governance-overview"
import { cn } from "@/lib/utils"

type GovernanceOverviewProps = {
  enabledRules: number
  metrics: GovernanceOverviewMetrics
  loading: boolean
}

type MetricKey = "enabledRules" | keyof GovernanceOverviewMetrics

type MetricDef = {
  key: MetricKey
  label: string
  hint: string
  icon: LucideIcon
  accent?: "risk"
}

const METRICS: MetricDef[] = [
  {
    key: "enabledRules",
    label: "启用规则",
    hint: "当前生效的治理规则",
    icon: Shield,
  },
  {
    key: "ruleHits",
    label: "规则命中",
    hint: "扫描触发的违规次数",
    icon: Target,
  },
  {
    key: "weeklyReviews",
    label: "本周评审 PR",
    hint: "近 7 天完成分析的 PR",
    icon: GitPullRequest,
  },
  {
    key: "highRiskPrs",
    label: "高风险 PR",
    hint: "严重或高风险的开放 PR",
    icon: AlertTriangle,
    accent: "risk",
  },
  {
    key: "interceptedRisks",
    label: "违规 PR",
    hint: "触发治理规则的 PR 数量",
    icon: ShieldAlert,
    accent: "risk",
  },
]

function MetricValue({
  value,
  accent,
}: {
  value: number
  accent?: "risk"
}) {
  const highlight = accent === "risk" && value > 0
  return (
    <p
      className={cn(
        "text-2xl font-semibold tabular-nums leading-none mt-2",
        highlight ? "text-risk-high" : "text-foreground",
      )}
    >
      {value}
    </p>
  )
}

export function GovernanceOverview({
  enabledRules,
  metrics,
  loading,
}: GovernanceOverviewProps) {
  const values: Record<MetricKey, number> = {
    enabledRules,
    ...metrics,
  }

  return (
    <section aria-label="治理概览" className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">治理概览</h2>
        <p className="text-[11px] text-muted-foreground hidden sm:block">
          规则执行与评审风险一览
        </p>
      </div>
      <div className="rounded-lg border border-border bg-surface-2 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">
          {METRICS.map((metric) => {
            const value = values[metric.key]
            const showSkeleton = loading && metric.key !== "enabledRules"
            const Icon = metric.icon

            return (
              <div
                key={metric.key}
                className="px-4 py-3.5 flex flex-col min-h-[84px] hover:bg-surface-3/30 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                  <p className="text-xs font-medium">{metric.label}</p>
                </div>
                {showSkeleton ? (
                  <Skeleton className="h-8 w-10 mt-2" />
                ) : (
                  <MetricValue value={value} accent={metric.accent} />
                )}
                <p className="text-[10px] text-muted-foreground/80 mt-1.5 leading-snug line-clamp-2">
                  {metric.hint}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
