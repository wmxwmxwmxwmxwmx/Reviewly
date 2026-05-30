"use client"

import { zh } from "@/lib/i18n/zh"
import { FINDINGS_SEVERITY_COLORS } from "@/lib/findings-severity-display"
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
    { label: zh.findings.totalRisks, value: stats.total, color: undefined as string | undefined },
    { label: zh.severity.critical, value: stats.critical, color: FINDINGS_SEVERITY_COLORS.critical },
    { label: zh.severity.high, value: stats.high, color: FINDINGS_SEVERITY_COLORS.high },
    { label: zh.severity.medium, value: stats.medium, color: FINDINGS_SEVERITY_COLORS.medium },
    { label: zh.severity.low, value: stats.low, color: FINDINGS_SEVERITY_COLORS.low },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 h-[88px]">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col justify-center rounded-md border border-border bg-surface-2/80 px-3 py-2 min-h-[80px]"
        >
          <p className="text-[11px] text-muted-foreground leading-none">{card.label}</p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums mt-1.5 leading-none",
              !card.color && "text-foreground",
            )}
            style={card.color ? { color: card.color } : undefined}
          >
            {loading ? "—" : card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
