"use client"

import { Skeleton } from "@/components/ui/skeleton"
import type { GovernanceOverviewMetrics } from "@/hooks/use-governance-overview"

type GovernanceOverviewProps = {
  enabledRules: number
  metrics: GovernanceOverviewMetrics
  loading: boolean
}

const METRICS = [
  { key: "enabledRules" as const, label: "启用规则", format: (v: number) => String(v) },
  { key: "ruleHits" as const, label: "规则命中", format: (v: number) => String(v) },
  { key: "weeklyReviews" as const, label: "本周评审 PR", format: (v: number) => String(v) },
  { key: "highRiskPrs" as const, label: "高风险 PR", format: (v: number) => String(v) },
  {
    key: "avgRiskScore" as const,
    label: "平均风险评分",
    format: (v: number) => (v > 0 ? String(v) : "—"),
  },
  { key: "interceptedRisks" as const, label: "已拦截风险", format: (v: number) => String(v) },
]

export function GovernanceOverview({
  enabledRules,
  metrics,
  loading,
}: GovernanceOverviewProps) {
  const values: Record<(typeof METRICS)[number]["key"], number> = {
    enabledRules,
    ...metrics,
  }

  return (
    <section aria-label="治理概览" className="space-y-2">
      <h2 className="text-sm font-medium text-foreground">治理概览</h2>
      <div className="rounded-lg border border-border bg-surface-2 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {METRICS.map((metric) => {
            const value = values[metric.key]
            const showSkeleton = loading && metric.key !== "enabledRules"
            return (
              <div key={metric.key} className="px-4 py-3 min-h-[72px]">
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                {showSkeleton ? (
                  <Skeleton className="h-7 w-12 mt-1.5" />
                ) : (
                  <p className="text-xl font-semibold tabular-nums text-foreground mt-1">
                    {metric.format(value)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
