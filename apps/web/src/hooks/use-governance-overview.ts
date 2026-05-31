"use client"

import { useEffect, useMemo, useState } from "react"

import type { GovernanceViolationItem } from "@/features/prism/views/governance/governance-shared"
import { fetchGovernanceViolations } from "@/lib/api/governance"
import { fetchReviewStats } from "@/lib/api/review-center"
import { isAbortError } from "@/lib/abort-utils"

export type GovernanceOverviewMetrics = {
  ruleHits: number
  weeklyReviews: number
  highRiskPrs: number
  interceptedRisks: number
}

export function useGovernanceOverview() {
  const [violations, setViolations] = useState<GovernanceViolationItem[]>([])
  const [weeklyReviews, setWeeklyReviews] = useState<number | null>(null)
  const [highRiskCount, setHighRiskCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    void Promise.all([
      fetchGovernanceViolations(ac.signal).catch(() => [] as GovernanceViolationItem[]),
      fetchReviewStats(ac.signal).catch(() => null),
    ])
      .then(([vList, stats]) => {
        if (ac.signal.aborted) return
        setViolations(vList as GovernanceViolationItem[])
        setWeeklyReviews(stats?.weeklyAnalysisCount ?? null)
        setHighRiskCount(stats?.highRiskCount ?? null)
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [])

  const hitCountByRule = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of violations) {
      const id = v.ruleId
      if (!id) continue
      map.set(id, (map.get(id) ?? 0) + 1)
    }
    return map
  }, [violations])

  const metrics = useMemo((): GovernanceOverviewMetrics => {
    const interceptedPrs = new Set(
      violations.map((v) => v.pullRequestId).filter(Boolean),
    ).size

    return {
      ruleHits: violations.length,
      weeklyReviews: weeklyReviews ?? 0,
      highRiskPrs: highRiskCount ?? 0,
      interceptedRisks: interceptedPrs > 0 ? interceptedPrs : violations.length,
    }
  }, [violations, weeklyReviews, highRiskCount])

  return { loading, hitCountByRule, metrics }
}
