"use client"

import type { ReviewStatus, ReviewStatusCounts } from "@reviewly/shared"
import { cn } from "@/lib/utils"
import { REVIEW_STATUS_TABS } from "@/features/prism/lib/review-status-utils"

interface ReviewStatusTabsProps {
  active: ReviewStatus | "ALL"
  counts?: Partial<ReviewStatusCounts>
  onChange: (status: ReviewStatus | "ALL") => void
}

export function ReviewStatusTabs({ active, counts, onChange }: ReviewStatusTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {REVIEW_STATUS_TABS.map((tab) => {
        const count = counts?.[tab.key as keyof ReviewStatusCounts]
        const showCount = tab.key !== "ALL" && typeof count === "number"
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors",
              active === tab.key
                ? "bg-ai-blue/15 text-ai-blue border-ai-blue/40"
                : "bg-surface-2 text-muted-foreground border-border hover:text-foreground hover:bg-surface-3",
            )}
          >
            {tab.label}
            {showCount ? (
              <span className="font-mono text-[10px] opacity-80">({count})</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
