"use client"

import { useCallback, useEffect, useState } from "react"
import type { GovernanceRule } from "@reviewly/shared"

import { fetchPullRequestGovernance } from "@/lib/api/governance"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError } from "@/lib/abort-utils"

export function usePullRequestGovernance(prId: string | null, enabled: boolean) {
  const [rules, setRules] = useState<GovernanceRule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!prId || !enabled) {
      setRules([])
      return []
    }
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPullRequestGovernance(prId, signal)
      setRules(data)
      return data
    } catch (e: unknown) {
      if (isAbortError(e)) return []
      setError(e instanceof PrismApiError ? e.message : "加载治理结果失败")
      setRules([])
      return []
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [prId, enabled])

  useEffect(() => {
    const ac = new AbortController()
    void reload(ac.signal)
    return () => ac.abort()
  }, [reload])

  return { rules, loading, error, reload }
}
