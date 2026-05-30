"use client"

import { useEffect, useMemo } from "react"

import { useDashboardContext } from "@/features/prism/contexts/dashboard-context"
import {
  useRunningTasksStore,
  type RunningTaskModule,
} from "@/features/prism/contexts/running-tasks-context"

export interface SidebarBadgeState {
  pullRequests: string | null
  aiReview: string | null
  security: string | null
  governance: string | null
  performance: string | null
}

const defaultBadges: SidebarBadgeState = {
  pullRequests: null,
  aiReview: null,
  security: null,
  governance: null,
  performance: null,
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
  const { data: dashboard, error: dashboardError, loading, refetch } = useDashboardContext()
  const clientCounts = useRunningTasksStore()

  const serverCounts = dashboard?.runningTasks ?? defaultRunningTasks

  const totalCounts = useMemo(() => {
    const totals = { ...defaultRunningTasks }
    for (const module of MODULES) {
      totals[module] = (serverCounts[module] ?? 0) + (clientCounts[module] ?? 0)
    }
    return totals
  }, [serverCounts, clientCounts])

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
    return {
      pullRequests: toBadge(totalCounts.pullRequests),
      aiReview: toBadge(totalCounts.aiReview),
      security: toBadge(totalCounts.security),
      governance: toBadge(totalCounts.governance),
      performance: toBadge(totalCounts.performance),
    }
  }, [dashboard, totalCounts])

  return { badges, error: dashboardError, loading }
}
