"use client"

import { useEffect, useMemo, useState } from "react"

import { useDashboardContext } from "@/features/prism/contexts/dashboard-context"
import { PrismApiError } from "@/lib/api/client"
import { fetchGovernanceViolations } from "@/lib/api/governance"

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

export function useSidebarBadges() {
  const { data: dashboard, error: dashboardError, loading } = useDashboardContext()
  const [governanceCount, setGovernanceCount] = useState<number | null>(null)
  const [govError, setGovError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setGovError(null)
    fetchGovernanceViolations(ac.signal)
      .then((violationsList) => setGovernanceCount(violationsList.length))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setGovError(e instanceof PrismApiError ? e.message : "加载失败")
        setGovernanceCount(null)
      })
    return () => ac.abort()
  }, [dashboard])

  const badges = useMemo<SidebarBadgeState>(() => {
    if (!dashboard) {
      return defaultBadges
    }
    const summary = dashboard.summary
    return {
      pullRequests:
        (summary?.openPrCount ?? dashboard.pendingPrs) > 0
          ? String(summary?.openPrCount ?? dashboard.pendingPrs)
          : null,
      aiReview: (summary?.highRiskCount ?? 0) > 0 ? String(summary?.highRiskCount) : null,
      security:
        (summary?.securityCount ?? dashboard.securityIssues) > 0
          ? String(summary?.securityCount ?? dashboard.securityIssues)
          : null,
      governance: governanceCount !== null && governanceCount > 0 ? String(governanceCount) : null,
      performance:
        (summary?.performanceCount ?? 0) > 0 ? String(summary?.performanceCount) : null,
    }
  }, [dashboard, governanceCount])

  return { badges, error: dashboardError ?? govError, loading }
}
