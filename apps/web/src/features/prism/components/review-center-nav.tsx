"use client"

import { History, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

export type ReviewCenterTab = "inbox" | "history"

const TABS: {
  key: ReviewCenterTab
  label: string
  icon: typeof Inbox
}[] = [
  { key: "inbox", label: "收件箱", icon: Inbox },
  { key: "history", label: "历史记录", icon: History },
]

interface ReviewCenterNavProps {
  active: ReviewCenterTab
  onChange: (tab: ReviewCenterTab) => void
  inboxBadge?: number
}

export function ReviewCenterNav({ active, onChange, inboxBadge }: ReviewCenterNavProps) {
  return (
    <nav className="flex flex-wrap gap-1 px-4 sm:px-5 py-2 border-b border-border bg-panel/80 shrink-0 overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors",
            active === tab.key
              ? "bg-ai-blue/15 text-ai-blue"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
          )}
        >
          <tab.icon className="w-3.5 h-3.5 shrink-0" />
          {tab.label}
          {tab.key === "inbox" && inboxBadge != null && inboxBadge > 0 ? (
            <span className="ml-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-ai-blue text-[10px] font-semibold text-primary-foreground inline-flex items-center justify-center">
              {inboxBadge > 99 ? "99+" : inboxBadge}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  )
}
