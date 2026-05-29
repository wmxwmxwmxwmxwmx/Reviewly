"use client"

import { useEffect, useState } from "react"

import { fetchPerformanceFindings, fetchPerformanceStats } from "@/lib/api/performance"
import { PrismApiError } from "@/lib/api/client"
import type { AnalysisFinding } from "@reviewly/shared"
import type { PerformanceStats } from "@/lib/api/performance"

export function usePerformance() {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [findings, setFindings] = useState<AnalysisFinding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    Promise.all([
      fetchPerformanceStats(ac.signal),
      fetchPerformanceFindings(ac.signal),
    ])
      .then(([s, f]) => {
        setStats(s)
        setFindings(f)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  return { stats, findings, loading, error }
}
