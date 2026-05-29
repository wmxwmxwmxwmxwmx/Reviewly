"use client"

import { useEffect, useState } from "react"

import { PrismApiError } from "@/lib/api/client"
import { fetchDashboard } from "@/lib/api/dashboard"
import { fetchPerformanceStats } from "@/lib/api/performance"
import { fetchPullRequests } from "@/lib/api/pull-requests"
import { fetchSecurityStats } from "@/lib/api/security"
import { fetchGovernanceRules } from "@/lib/api/governance"

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
  const [badges, setBadges] = useState<SidebarBadgeState>(defaultBadges)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()

    fetchDashboard(ac.signal)
      .then(async (dash) => {
        const summary = dash.summary
        let governance: string | null = null
        try {
          const rules = await fetchGovernanceRules(ac.signal)
          const violations = rules.filter((rule) => rule.violated).length
          governance = violations > 0 ? String(violations) : null
        } catch {
          /* optional */
        }
        setBadges({
          pullRequests:
            (summary?.openPrCount ?? dash.pendingPrs) > 0
              ? String(summary?.openPrCount ?? dash.pendingPrs)
              : null,
          aiReview:
            (summary?.highRiskCount ?? 0) > 0 ? String(summary?.highRiskCount) : null,
          security:
            (summary?.securityCount ?? dash.securityIssues) > 0
              ? String(summary?.securityCount ?? dash.securityIssues)
              : null,
          governance,
          performance:
            (summary?.performanceCount ?? 0) > 0
              ? String(summary?.performanceCount)
              : null,
        })
      })
      .catch(() => {
        Promise.all([
          fetchPullRequests({ state: "open" }, ac.signal),
          fetchSecurityStats(ac.signal),
          fetchPerformanceStats(ac.signal),
          fetchGovernanceRules(ac.signal),
        ])
          .then(([prs, security, performance, rules]) => {
            const reviewBacklog = prs.items.filter(
              (pr) => pr.riskLevel === "high" || pr.riskLevel === "critical"
            ).length
            const violations = rules.filter((rule) => rule.violated).length

            setBadges({
              pullRequests: prs.items.length > 0 ? String(prs.items.length) : null,
              aiReview: reviewBacklog > 0 ? String(reviewBacklog) : null,
              security: security.openFindings > 0 ? String(security.openFindings) : null,
              governance: violations > 0 ? String(violations) : null,
              performance: performance.openFindings > 0 ? String(performance.openFindings) : null,
            })
          })
          .catch((e: unknown) => {
            if (e instanceof DOMException && e.name === "AbortError") return
            setError(e instanceof PrismApiError ? e.message : "加载失败")
          })
      })

    return () => ac.abort()
  }, [])

  return { badges, error }
}
