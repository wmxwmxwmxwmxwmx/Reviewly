"use client"

import {
  BarChart3,
  ClipboardCheck,
  GitPullRequest,
  LayoutDashboard,
  ScrollText,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type ReviewCenterTab =
  | "dashboard"
  | "pending"
  | "all"
  | "rules"
  | "stats"
  | "settings"

const TABS: { key: ReviewCenterTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "工作台", icon: LayoutDashboard },
  { key: "pending", label: "我的待审批", icon: ClipboardCheck },
  { key: "all", label: "全部 PR", icon: GitPullRequest },
  { key: "rules", label: "审批规则", icon: ScrollText },
  { key: "stats", label: "数据统计", icon: BarChart3 },
  { key: "settings", label: "设置", icon: Settings },
]

interface ReviewCenterNavProps {
  active: ReviewCenterTab
  onChange: (tab: ReviewCenterTab) => void
}

export function ReviewCenterNav({ active, onChange }: ReviewCenterNavProps) {
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
        </button>
      ))}
    </nav>
  )
}
