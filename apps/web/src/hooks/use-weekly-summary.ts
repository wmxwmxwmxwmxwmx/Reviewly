"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchWeeklySummary } from "@/lib/api/dashboard"
import { PrismApiError } from "@/lib/api/client"
import { useDashboard } from "@/hooks/use-dashboard"

export function useWeeklySummary() {
  const { data: dashboard, refetch: refetchDashboard } = useDashboard()
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cached = dashboard?.weeklySummary?.content
    if (cached) {
      setContent(cached)
    }
  }, [dashboard?.weeklySummary?.content])

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWeeklySummary()
      setContent(res.content)
      await refetchDashboard()
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "生成失败")
    } finally {
      setLoading(false)
    }
  }, [refetchDashboard])

  return { content, loading, error, generate }
}
