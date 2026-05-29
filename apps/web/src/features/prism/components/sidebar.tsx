"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  GitPullRequest,
  BrainCircuit,
  Shield,
  Gauge,
  Network,
  GitBranch,
  BookOpen,
  Users,
  Settings,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Zap,
} from "lucide-react"
import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

export type NavView = 
  | "dashboard"
  | "pull-requests"
  | "ai-review"
  | "security"
  | "performance"
  | "architecture"
  | "governance"
  | "repos"
  | "team"
  | "settings"

const navItems: { icon: typeof LayoutDashboard; label: string; view: NavView; badge: string | null }[] = [
  { icon: LayoutDashboard, label: zh.nav.dashboard, view: "dashboard", badge: null },
  { icon: GitPullRequest, label: zh.nav.pullRequests, view: "pull-requests", badge: "12" },
  { icon: BrainCircuit, label: zh.nav.aiReview, view: "ai-review", badge: "3" },
  { icon: Shield, label: zh.nav.security, view: "security", badge: "5" },
  { icon: Gauge, label: zh.nav.performance, view: "performance", badge: null },
  { icon: Network, label: zh.nav.architecture, view: "architecture", badge: null },
  { icon: GitBranch, label: zh.nav.governance, view: "governance", badge: "2" },
  { icon: BookOpen, label: zh.nav.repos, view: "repos", badge: null },
  { icon: Users, label: zh.nav.team, view: "team", badge: null },
  { icon: Settings, label: zh.nav.settings, view: "settings", badge: null },
]

interface SidebarProps {
  className?: string
  activeView: NavView
  onViewChange: (view: NavView) => void
  mobile?: boolean
  onClose?: () => void
}

export function Sidebar({ className, activeView, onViewChange, mobile, onClose }: SidebarProps) {
  const { settings, providerLabel, hasApiKey, monthlyUsage } = useAISettings()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const configured = mounted && hasApiKey
  const modelUsagePercent = configured ? 67 : 8
  const monthlyTokens = monthlyUsage.totalTokens >= 1_000_000
    ? `${(monthlyUsage.totalTokens / 1_000_000).toFixed(1)}M`
    : monthlyUsage.totalTokens >= 1_000
      ? `${(monthlyUsage.totalTokens / 1_000).toFixed(1)}K`
      : monthlyUsage.totalTokens.toLocaleString()

  return (
    <aside
      className={cn(
        "flex flex-col w-[260px] shrink-0 h-screen bg-sidebar-surface border-r border-border overflow-hidden shadow-[20px_0_60px_rgba(0,0,0,0.28)]",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-gradient-to-r from-ai-blue/5 to-ai-purple/5">
        <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
          <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8 drop-shadow-[0_0_14px_rgba(56,189,248,0.22)]">
            <rect x="2" y="2" width="28" height="28" rx="6" fill="#0D1117" stroke="rgba(56,189,248,0.28)" />
            <path d="M8 24L16 8L24 24" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.view === activeView
            return (
              <li key={item.label}>
                <motion.button
                  onClick={() => onViewChange(item.view)}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group w-full text-left",
                    isActive
                      ? "bg-ai-blue/10 text-foreground ring-1 ring-ai-blue/20 shadow-[0_0_24px_rgba(56,189,248,0.08)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
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
                      isActive ? "text-ai-blue" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        isActive
                          ? "bg-ai-blue/20 text-ai-blue"
                          : "bg-surface-3 text-muted-foreground"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </motion.button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Status Footer */}
      <div className="border-t border-border p-3 space-y-2">
        {/* GitHub Status */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-risk-low shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-foreground">GitHub 已连接</div>
            <div className="text-[10px] text-muted-foreground truncate">enterprise.github.com</div>
          </div>
        </div>

        {/* AI Model */}
        <button
          type="button"
          onClick={() => onViewChange("settings")}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 transition-colors text-left w-full group"
        >
          <Cpu
            suppressHydrationWarning
            className={cn(
              "w-3.5 h-3.5 shrink-0",
              configured ? "text-ai-blue" : "text-risk-medium",
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-foreground truncate">{settings.model || "未选择模型"}</div>
              <span
                suppressHydrationWarning
                className={cn(
                  "text-[9px] shrink-0",
                  configured ? "text-risk-low" : "text-risk-medium",
                )}
              >
                {configured ? "已配置" : "未配置"}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <div className="flex-1 h-1 rounded-full bg-surface-4 overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    configured ? "bg-ai-blue" : "bg-risk-medium",
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${modelUsagePercent}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </div>
              <span suppressHydrationWarning className="text-[9px] text-muted-foreground shrink-0">
                {configured ? "67K / 100K" : providerLabel}
              </span>
            </div>
          </div>
        </button>

        {/* Token Usage */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-2">
          <Zap className="w-3.5 h-3.5 text-risk-medium shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-foreground">本月用量</div>
            <div className="text-[10px] text-muted-foreground">
              {monthlyTokens} tokens · ¥{monthlyUsage.costCny.toFixed(2)} · {monthlyUsage.calls} 次
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-accent transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-ai-blue to-ai-purple flex items-center justify-center text-[11px] font-semibold text-white shrink-0 shadow-[0_0_18px_rgba(139,92,246,0.22)]">
            ZW
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-foreground truncate">张维</div>
            <div className="text-[10px] text-muted-foreground truncate">infra-platform · 高级工程师</div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
      </div>
    </aside>
  )
}
