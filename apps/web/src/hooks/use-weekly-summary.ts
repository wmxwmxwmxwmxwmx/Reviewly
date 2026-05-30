"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { fetchWeeklySummary } from "@/lib/api/dashboard"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { PrismApiError } from "@/lib/api/client"
import type { DashboardStats } from "@reviewly/shared"

type DashboardRefetch = () => void | Promise<unknown>

export function useWeeklySummary(
  dashboard: DashboardStats | null | undefined,
  refetchDashboard: DashboardRefetch,
) {
  const { settings, hasApiKey } = useAISettings()
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generateAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setContent(dashboard?.weeklySummary?.content ?? null)
  }, [dashboard?.weeklySummary?.content])

  useEffect(() => {
    return () => {
      generateAbortRef.current?.abort()
    }
  }, [])

  const generate = useCallback(async () => {
    if (!hasApiKey) {
      setError("请先在系统设置中配置 API Key")
      return
    }
    generateAbortRef.current?.abort()
    const ac = new AbortController()
    generateAbortRef.current = ac

    setLoading(true)
    setError(null)
    try {
      const res = await fetchWeeklySummary(settings.apiKey, ac.signal)
      if (shouldApplyResult(ac.signal)) {
        setContent(res.content)
        await refetchDashboard()
      }
    } catch (e: unknown) {
      if (isAbortError(e)) return
      setError(e instanceof PrismApiError ? e.message : "生成失败")
    } finally {
      if (shouldApplyResult(ac.signal)) {
        setLoading(false)
      }
    }
  }, [hasApiKey, settings.apiKey, refetchDashboard])

  return { content, loading, error, generate }
}
