"use client"

import type { InboxSegment } from "@/features/prism/types/review-task"
import { cn } from "@/lib/utils"

const SEGMENTS: { key: InboxSegment; label: string }[] = [
  { key: "unread", label: "未查阅" },
  { key: "high_risk", label: "高风险" },
  { key: "needs_revisit", label: "需要复查" },
  { key: "all", label: "全部" },
]

type InboxSegmentControlProps = {
  active: InboxSegment
  onChange: (segment: InboxSegment) => void
}

export function InboxSegmentControl({ active, onChange }: InboxSegmentControlProps) {
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {SEGMENTS.map((seg) => (
        <button
          key={seg.key}
          type="button"
          onClick={() => onChange(seg.key)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
            active === seg.key
              ? "bg-ai-blue/15 text-ai-blue"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
          )}
        >
          {seg.label}
        </button>
      ))}
    </div>
  )
}

export type { InboxSegment }
