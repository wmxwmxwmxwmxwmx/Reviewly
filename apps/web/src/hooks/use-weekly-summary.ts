"use client"

import { useCallback, useEffect, useState } from "react"

import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { fetchWeeklySummary } from "@/lib/api/dashboard"
import { PrismApiError } from "@/lib/api/client"
import { useDashboard } from "@/hooks/use-dashboard"

export function useWeeklySummary() {
  const { data: dashboard, refetch: refetchDashboard } = useDashboard()
  const { settings, hasApiKey } = useAISettings()
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
    if (!hasApiKey) {
      setError("请先在系统设置中配置 API Key")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWeeklySummary(settings.apiKey)
      setContent(res.content)
      await refetchDashboard()
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "生成失败")
    } finally {
      setLoading(false)
    }
  }, [hasApiKey, settings.apiKey, refetchDashboard])

  return { content, loading, error, generate }
}
