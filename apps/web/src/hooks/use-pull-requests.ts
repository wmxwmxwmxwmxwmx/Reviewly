"use client"

import { useEffect, useState } from "react"

import { fetchPullRequests } from "@/lib/api/pull-requests"
import { PrismApiError } from "@/lib/api/client"
import type { PullRequestListItem } from "@reviewly/shared"

export function usePullRequests(filters?: Record<string, string | undefined>) {
  const [items, setItems] = useState<PullRequestListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    fetchPullRequests(filters, ac.signal)
      .then((res) => setItems(res.items))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [JSON.stringify(filters ?? {})])

  return { items, loading, error }
}
