"use client"

import type { FindingCategory, FindingsCategoryStats } from "@reviewly/shared"

import { RISK_CATEGORIES } from "@/lib/findings-categories"
import { cn } from "@/lib/utils"
import { severityConfig } from "@/features/prism/components/security-findings-table"

interface RiskCategoryCardsProps {
  categoryStats: FindingsCategoryStats
  activeId: FindingCategory | null
  loading?: boolean
  onSelect: (id: FindingCategory | null) => void
}

function countTone(
  categoryId: FindingCategory,
  maxSeverity: FindingsCategoryStats["maxSeverity"],
  fallback: string,
): string {
  const sev = maxSeverity[categoryId]
  if (!sev) return fallback
  return severityConfig[sev]?.color ?? fallback
}

export function RiskCategoryCards({
  categoryStats,
  activeId,
  loading,
  onSelect,
}: RiskCategoryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {RISK_CATEGORIES.map((cat) => {
        const count = categoryStats.counts[cat.id] ?? 0
        const active = activeId === cat.id
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(active ? null : cat.id)}
            className={cn(
              "rounded-lg border bg-card px-3 py-3 text-left transition-colors",
              active
                ? "border-ai-blue/40 bg-ai-blue/10 ring-1 ring-ai-blue/20"
                : "border-border hover:bg-surface-2/80",
            )}
          >
            <span className="text-lg" aria-hidden>
              {cat.icon}
            </span>
            <p className="text-xs text-muted-foreground mt-1">{cat.label}</p>
            <p
              className={cn(
                "text-2xl font-semibold mt-0.5 tabular-nums",
                loading ? "text-muted-foreground" : countTone(cat.id, categoryStats.maxSeverity, cat.countTone),
              )}
            >
              {loading ? "—" : count}
            </p>
          </button>
        )
      })}
    </div>
  )
}
