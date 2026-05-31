"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { fetchPullRequestsWithCounts } from "@/lib/api/review-center"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import type { PullRequest, ReviewStatusCounts } from "@reviewly/shared"

export function usePullRequests(filters?: Record<string, string | undefined>) {
  const [items, setItems] = useState<PullRequest[]>([])
  const [statusCounts, setStatusCounts] = useState<ReviewStatusCounts | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filterKey = JSON.stringify(filters ?? {})
  const loadAbortRef = useRef<AbortController | null>(null)

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const useCounts = filters?.includeCounts === "true"
        const res = useCounts
          ? await fetchPullRequestsWithCounts(filters, signal)
          : await import("@/lib/api/pull-requests").then((m) =>
              m.fetchPullRequests(filters, signal),
            )
        setItems(res.items)
        if (useCounts) {
          const counts = (res as { statusCounts?: ReviewStatusCounts }).statusCounts
          if (counts) setStatusCounts(counts)
        }
      } catch (e: unknown) {
        if (isAbortError(e)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      } finally {
        if (shouldApplyResult(signal)) setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKey serializes filters
    [filterKey],
  )

  useEffect(() => {
    loadAbortRef.current?.abort()
    const ac = new AbortController()
    loadAbortRef.current = ac
    void load(ac.signal)
    return () => {
      ac.abort()
      if (loadAbortRef.current === ac) {
        loadAbortRef.current = null
      }
    }
  }, [load])

  const reload = useCallback(() => {
    loadAbortRef.current?.abort()
    const ac = new AbortController()
    loadAbortRef.current = ac
    void load(ac.signal)
  }, [load])

  return { items, statusCounts, loading, error, reload }
}
