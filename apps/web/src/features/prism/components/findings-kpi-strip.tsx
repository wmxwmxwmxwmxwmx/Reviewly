"use client"

import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface FindingsKpiStripProps {
  stats: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
  }
  loading?: boolean
}

export function FindingsKpiStrip({ stats, loading }: FindingsKpiStripProps) {
  const cards = [
    { label: zh.findings.totalRisks, value: stats.total, tone: "text-foreground" },
    { label: zh.severity.critical, value: stats.critical, tone: "text-[oklch(0.55_0.22_27)]" },
    { label: zh.severity.high, value: stats.high, tone: "text-risk-high" },
    { label: zh.severity.medium, value: stats.medium, tone: "text-risk-medium" },
    { label: zh.severity.low, value: stats.low, tone: "text-muted-foreground" },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <p className="text-[11px] text-muted-foreground">{card.label}</p>
          <p className={cn("text-xl font-semibold mt-0.5", card.tone)}>
            {loading ? "—" : card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
