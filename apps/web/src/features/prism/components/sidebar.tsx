"use client"

import { motion } from "framer-motion"
import {
  LayoutDashboard,
  BrainCircuit,
  AlertTriangle,
  BookOpen,
  Settings,
  ChevronRight,
} from "lucide-react"
import { SidebarFooter } from "@/features/prism/components/sidebar-footer"
import { useHydrated } from "@/hooks/use-hydrated"
import { useSidebarBadges } from "@/hooks/use-sidebar-badges"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

/** Primary sidebar entries shown to users. */
export type PrimaryNavView =
  | "dashboard"
  | "repos"
  | "ai-review"
  | "findings"
  | "settings"

/** Legacy / deep-link views kept routable but hidden from sidebar. */
export type HiddenNavView =
  | "pull-requests"
  | "security"
  | "performance"
  | "architecture"
  | "governance"
  | "team"

export type NavView = PrimaryNavView | HiddenNavView

const primaryNavItems: {
  icon: typeof LayoutDashboard
  label: string
  view: PrimaryNavView
}[] = [
  { icon: LayoutDashboard, label: zh.nav.dashboard, view: "dashboard" },
  { icon: BookOpen, label: zh.nav.repos, view: "repos" },
  { icon: BrainCircuit, label: zh.nav.aiReview, view: "ai-review" },
  { icon: AlertTriangle, label: zh.nav.findings, view: "findings" },
  { icon: Settings, label: zh.nav.settings, view: "settings" },
]

interface SidebarProps {
  className?: string
  activeView: NavView
  onViewChange: (view: NavView) => void
  mobile?: boolean
  onClose?: () => void
}

export function Sidebar({ className, activeView, onViewChange, mobile, onClose }: SidebarProps) {
  const hydrated = useHydrated()
  const { badges } = useSidebarBadges()

  const sidebarActive =
    primaryNavItems.find((i) => i.view === activeView)?.view ??
    (activeView === "security" || activeView === "performance" ? "findings" : null)

  return (
    <aside
      className={cn(
        "flex flex-col w-[260px] shrink-0 h-screen bg-sidebar-surface border-r border-border overflow-hidden shadow-[20px_0_60px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-gradient-to-r from-ai-blue/5 to-ai-purple/5">
        <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
          <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8 drop-shadow-[0_0_14px_rgba(56,189,248,0.22)]">
            <rect x="2" y="2" width="28" height="28" rx="6" fill="#0D1117" stroke="rgba(56,189,248,0.28)" />
            <path
              d="M8 24L16 8L24 24"
              stroke="#38BDF8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M10.5 19h11" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
            <circle cx="16" cy="8" r="2" fill="#E5E7EB" />
          </svg>
        </div>
        <div className="flex flex-col leading-tight min-w-0 flex-1">
          <span className="text-sm font-semibold tracking-wide text-foreground">PRism</span>
          <span className="text-[10px] text-muted-foreground truncate">AI 智能代码评审平台</span>
        </div>
        {mobile && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors shrink-0"
            aria-label="关闭菜单"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {primaryNavItems.map((item) => {
            const isActive = sidebarActive === item.view
            const badge =
              item.view === "ai-review"
                ? badges.aiReview
                : item.view === "findings"
                  ? badges.findings
                  : null
            return (
              <li key={item.view}>
                <motion.button
                  onClick={() => onViewChange(item.view)}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group w-full text-left",
                    isActive
                      ? "bg-ai-blue/10 text-foreground ring-1 ring-ai-blue/20 shadow-[0_0_24px_rgba(56,189,248,0.08)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                  whileHover={{ x: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  {isActive && (
                    <motion.div
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-ai-blue"
                      layoutId="nav-active"
                    />
                  )}
                  <item.icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      isActive ? "text-ai-blue" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {hydrated && badge && (
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        isActive ? "bg-ai-blue/20 text-ai-blue" : "bg-surface-3 text-muted-foreground",
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </motion.button>
              </li>
            )
          })}
        </ul>
      </nav>

      <SidebarFooter onOpenSettings={() => onViewChange("settings")} onNavigate={onViewChange} />
    </aside>
  )
}
