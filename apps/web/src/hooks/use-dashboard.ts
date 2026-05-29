"use client"

import { useEffect, useState } from "react"

import { fetchDashboard } from "@/lib/api/dashboard"
import { PrismApiError } from "@/lib/api/client"
import type { DashboardStats } from "@reviewly/shared"

export function useDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    fetchDashboard(ac.signal)
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  return { data, loading, error }
}
