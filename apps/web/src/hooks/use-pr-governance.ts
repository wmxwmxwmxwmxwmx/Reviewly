"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchPullRequestGovernance } from "@/lib/api/governance"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import type { GovernanceRule } from "@reviewly/shared"

export function usePrGovernance(prId: string | null, refreshKey = 0) {
  const [rules, setRules] = useState<GovernanceRule[]>([])
  const [loading, setLoading] = useState(Boolean(prId))
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!prId) {
        setRules([])
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      setRules([])
      try {
        const data = await fetchPullRequestGovernance(prId, signal)
        setRules(data)
      } catch (e: unknown) {
        if (isAbortError(e)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
        setRules([])
      } finally {
        if (shouldApplyResult(signal)) setLoading(false)
      }
    },
    [prId],
  )

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load, refreshKey])

  return { rules, loading, error, refetch: load }
}
