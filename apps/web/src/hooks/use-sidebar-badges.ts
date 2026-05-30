"use client"

import { useEffect, useMemo } from "react"

import { useDashboardContext } from "@/features/prism/contexts/dashboard-context"
import { useFindingsStatsOptional } from "@/features/prism/contexts/findings-stats-context"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import {
  useRunningTasksStore,
  type RunningTaskModule,
} from "@/features/prism/contexts/running-tasks-context"

export interface SidebarBadgeState {
  pullRequests: string | null
  aiReview: string | null
  findings: string | null
  governance: string | null
}

const defaultBadges: SidebarBadgeState = {
  pullRequests: null,
  aiReview: null,
  findings: null,
  governance: null,
}

const defaultRunningTasks = {
  pullRequests: 0,
  aiReview: 0,
  security: 0,
  governance: 0,
  performance: 0,
}

const MODULES: RunningTaskModule[] = [
  "pullRequests",
  "aiReview",
  "security",
  "governance",
  "performance",
]

function toBadge(count: number): string | null {
  return count > 0 ? String(count) : null
}

export function useSidebarBadges() {
  const { activeView } = useNavigation()
  const { data: dashboard, error: dashboardError, loading, refetch } = useDashboardContext()
  const findingsStatsCtx = useFindingsStatsOptional()
  const clientCounts = useRunningTasksStore()

  const serverCounts = dashboard?.runningTasks ?? defaultRunningTasks

  const totalCounts = useMemo(() => {
    const totals = { ...defaultRunningTasks }
    for (const module of MODULES) {
      totals[module] = (serverCounts[module] ?? 0) + (clientCounts[module] ?? 0)
    }
    return totals
  }, [serverCounts, clientCounts])

  const findingsOpenCount = useMemo(() => {
    const summary = dashboard?.summary
    const security = summary?.securityCount ?? dashboard?.securityIssues ?? 0
    const performance = summary?.performanceCount ?? 0
    return security + performance
  }, [dashboard])

  const hasRunningTasks = useMemo(
    () => MODULES.some((module) => totalCounts[module] > 0),
    [totalCounts],
  )

  useEffect(() => {
    if (!hasRunningTasks) return
    const id = window.setInterval(() => {
      void refetch()
    }, 3000)
    return () => window.clearInterval(id)
  }, [hasRunningTasks, refetch])

  const badges = useMemo<SidebarBadgeState>(() => {
    if (!dashboard) {
      return defaultBadges
    }
    const findingsTaskCount = totalCounts.security + totalCounts.performance
    const filteredFindingsCount =
      activeView === "findings" && findingsStatsCtx ? findingsStatsCtx.stats.total : null
    const findingsBadgeCount = Math.max(
      filteredFindingsCount ?? findingsOpenCount,
      findingsTaskCount,
    )
    return {
      pullRequests: toBadge(totalCounts.pullRequests),
      aiReview: toBadge(totalCounts.aiReview),
      findings: toBadge(findingsBadgeCount),
      governance: toBadge(totalCounts.governance),
    }
  }, [dashboard, totalCounts, findingsOpenCount, activeView, findingsStatsCtx])

  return { badges, error: dashboardError, loading }
}
