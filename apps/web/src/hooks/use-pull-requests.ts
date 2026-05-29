"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchPullRequests } from "@/lib/api/pull-requests"
import { PrismApiError } from "@/lib/api/client"
import type { PullRequest } from "@reviewly/shared"

export function usePullRequests(filters?: Record<string, string | undefined>) {
  const [items, setItems] = useState<PullRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filterKey = JSON.stringify(filters ?? {})

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchPullRequests(filters, signal)
        setItems(res.items)
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKey serializes filters
    [filterKey],
  )

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const reload = useCallback(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  return { items, loading, error, reload }
}
