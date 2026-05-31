"use client"

import { motion } from "framer-motion"
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import type { GovernanceOverviewMetrics } from "@/hooks/use-governance-overview"
import { cn } from "@/lib/utils"

type GovernanceOverviewProps = {
  enabledRules: number
  metrics: GovernanceOverviewMetrics
  loading: boolean
}

const CARDS = [
  {
    key: "enabledRules" as const,
    label: "启用规则",
    icon: ShieldCheck,
    color: "text-ai-blue",
    format: (v: number) => String(v),
  },
  {
    key: "ruleHits" as const,
    label: "规则命中",
    icon: Target,
    color: "text-ai-purple",
    format: (v: number) => String(v),
  },
  {
    key: "weeklyReviews" as const,
    label: "本周评审 PR",
    icon: ClipboardCheck,
    color: "text-ai-blue",
    format: (v: number) => String(v),
  },
  {
    key: "highRiskPrs" as const,
    label: "高风险 PR",
    icon: ShieldAlert,
    color: "text-risk-high",
    format: (v: number) => String(v),
  },
  {
    key: "avgRiskScore" as const,
    label: "平均风险评分",
    icon: BarChart3,
    color: "text-risk-medium",
    format: (v: number) => (v > 0 ? `${v}` : "—"),
  },
  {
    key: "interceptedRisks" as const,
    label: "已拦截风险",
    icon: Activity,
    color: "text-risk-critical",
    format: (v: number) => String(v),
  },
]

export function GovernanceOverview({
  enabledRules,
  metrics,
  loading,
}: GovernanceOverviewProps) {
  const values: Record<(typeof CARDS)[number]["key"], number> = {
    enabledRules,
    ...metrics,
  }

  return (
    <section aria-label="治理概览" className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-foreground">治理概览</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          团队规范执行与风险拦截成效一览
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {CARDS.map((card, idx) => {
          const Icon = card.icon
          const value = values[card.key]
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={cn(
                "group relative h-[88px] overflow-hidden rounded-lg border border-ai-blue/20 bg-surface-2 px-3.5 py-3",
                "transition-all duration-200 hover:border-ai-blue/45 hover:shadow-[0_0_24px_-8px_var(--ai-blue-glow)]",
              )}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ai-blue/50 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-3",
                    card.color,
                  )}
                >
                  <Icon className="size-3.5" />
                </div>
              </div>
              <div className="mt-2">
                {loading && card.key !== "enabledRules" ? (
                  <Skeleton className="h-6 w-10" />
                ) : (
                  <p className="text-xl font-semibold tabular-nums text-foreground leading-none">
                    {card.format(value)}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1.5">{card.label}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
