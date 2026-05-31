"use client"

import { AlertCircle, CheckCircle2, ChevronRight, Activity, Loader2 } from "lucide-react"

import { ProviderIcon } from "@/features/prism/components/provider-icon"
import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { useAuth } from "@/features/prism/contexts/auth-context"
import { AccountMenu } from "@/features/prism/components/account-menu"
import type { NavView } from "@/features/prism/components/sidebar"
import { useProviderBalance } from "@/hooks/use-provider-balance"
import { useSidebarStatus } from "@/hooks/use-sidebar-status"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

function formatTokenCount(total: number): string {
  if (total >= 1_000_000) {
    return `${(total / 1_000_000).toFixed(1)}M`
  }
  if (total >= 1_000) {
    return `${(total / 1_000).toFixed(1)}K`
  }
  return total.toLocaleString()
}

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || "?"
}

function FooterSkeleton() {
  return (
    <div className="border-t border-border p-3 space-y-2" aria-hidden>
      <div className="h-10 rounded-md bg-surface-2 animate-pulse" />
      <div className="h-14 rounded-md bg-surface-2 animate-pulse" />
      <div className="h-10 rounded-md bg-surface-2 animate-pulse" />
      <div className="h-11 rounded-md bg-surface-2 animate-pulse" />
    </div>
  )
}

interface SidebarFooterProps {
  onOpenSettings: () => void
  onNavigate: (view: NavView) => void
}

export function SidebarFooter({ onOpenSettings, onNavigate }: SidebarFooterProps) {
  const { settings, settingsHydrated, providerLabel, hasApiKey, monthlyUsage } = useAISettings()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { github, member, ready: statusReady } = useSidebarStatus()
  const { balance, loading: balanceLoading } = useProviderBalance({
    enabled: settingsHydrated && hasApiKey,
    provider: settings.provider,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
  })

  if (!settingsHydrated || !statusReady || authLoading) {
    return <FooterSkeleton />
  }

  const configured = hasApiKey
  const displayModel = settings.model || zh.sidebar.noModelSelected
  const monthlyTokens = formatTokenCount(monthlyUsage.totalTokens)

  const balanceLabel = (() => {
    if (!configured) return providerLabel
    if (balanceLoading && !balance) return zh.sidebar.balanceLoading
    if (balance?.available && balance.amount) return balance.amount
    if (balance?.message) return balance.message
    return zh.sidebar.balanceUnavailable
  })()

  const githubConnected = (github?.connected ?? false) || isAuthenticated
  const githubHost = isAuthenticated
    ? (user?.username ? `@${user.username}` : "github.com")
    : (github?.hostLabel ?? zh.sidebar.githubNotConnectedHint)

  return (
    <div className="border-t border-border p-3 space-y-2">
      <button
        type="button"
        onClick={onOpenSettings}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-2 w-full text-left transition-colors",
          githubConnected ? "hover:bg-surface-3" : "hover:bg-surface-3 ring-1 ring-risk-medium/20",
        )}
      >
        {githubConnected ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-risk-low shrink-0" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5 text-risk-medium shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-foreground">
            {githubConnected ? zh.sidebar.githubConnected : zh.sidebar.githubDisconnected}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{githubHost}</div>
        </div>
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-2 hover:bg-surface-3 transition-colors text-left w-full"
      >
        <ProviderIcon provider={settings.provider} className="size-4 rounded-[5px]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-medium text-foreground truncate">{displayModel}</div>
            <span
              className={cn(
                "text-[9px] shrink-0",
                configured ? "text-risk-low" : "text-risk-medium",
              )}
            >
              {configured ? zh.sidebar.aiConfigured : zh.sidebar.aiNotConfigured}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">{zh.sidebar.currentBalance}</span>
            <span
              className={cn(
                "text-[10px] font-medium truncate",
                balance?.available ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {balanceLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  {balanceLabel}
                </span>
              ) : (
                balanceLabel
              )}
            </span>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-2">
        <Activity className="w-3.5 h-3.5 text-risk-medium shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-foreground">{zh.sidebar.monthlyUsage}</div>
          <div className="text-[10px] text-muted-foreground">
            {monthlyTokens} {zh.settings.tokensUnit} · ¥{monthlyUsage.costCny.toFixed(2)} ·{" "}
            {monthlyUsage.calls} {zh.settings.callsUnit}
          </div>
        </div>
      </div>

      {isAuthenticated && user ? (
        <AccountMenu user={user} onNavigate={onNavigate} />
      ) : member ? (
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-accent transition-colors">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-ai-blue to-ai-purple flex items-center justify-center text-[11px] font-semibold text-white shrink-0 shadow-[0_0_18px_rgba(139,92,246,0.22)]">
            {memberInitials(member.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-foreground truncate">{member.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">{member.role}</div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-accent transition-colors text-left w-full"
        >
          <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
            ?
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-foreground">{zh.sidebar.notLoggedIn}</div>
            <div className="text-[10px] text-muted-foreground truncate">{zh.sidebar.signInHint}</div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>
      )}
    </div>
  )
}
