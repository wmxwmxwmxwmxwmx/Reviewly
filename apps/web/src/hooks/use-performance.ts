"use client"

import { useEffect, useState } from "react"

import { fetchPerformanceStats } from "@/lib/api/performance"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import type { PerformanceStats } from "@/lib/api/performance"

/** Stats-only hook for sidebar badges. */
export function usePerformance() {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    fetchPerformanceStats(ac.signal)
      .then(setStats)
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => {
        if (shouldApplyResult(ac.signal)) setLoading(false)
      })
    return () => ac.abort()
  }, [])

  return { stats, loading, error }
}
