"use client"

import type { FindingCategory } from "@reviewly/shared"

import { RISK_CATEGORY_TABS } from "@/lib/findings-categories"
import { cn } from "@/lib/utils"

interface RiskCategoryTabsProps {
  activeId: FindingCategory | null
  /** Resolved count per tab (already aligned with list filters + active tab total). */
  tabCounts: Record<string, number>
  loading?: boolean
  onSelect: (id: FindingCategory | null) => void
}

export function RiskCategoryTabs({
  activeId,
  tabCounts,
  loading,
  onSelect,
}: RiskCategoryTabsProps) {
  return (
    <div
      className="flex items-center gap-1 overflow-x-auto border-b border-border pb-0 scrollbar-thin"
      role="tablist"
    >
      {RISK_CATEGORY_TABS.map((tab) => {
        const active = tab.id === "all" ? activeId === null : activeId === tab.id
        const count = tabCounts[tab.id] ?? 0
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (tab.id === "all") onSelect(null)
              else onSelect(tab.id)
            }}
            className={cn(
              "shrink-0 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-ai-blue text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {tab.label}
            <span className="text-muted-foreground font-normal ml-0.5">
              ({loading ? "—" : count})
            </span>
          </button>
        )
      })}
    </div>
  )
}
