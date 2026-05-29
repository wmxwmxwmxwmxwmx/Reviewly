"use client"

import { useCallback, useState } from "react"

import { fetchWeeklySummary } from "@/lib/api/dashboard"
import { PrismApiError } from "@/lib/api/client"

export function useWeeklySummary() {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWeeklySummary()
      setContent(res.content)
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "生成失败")
    } finally {
      setLoading(false)
    }
  }, [])

  return { content, loading, error, generate }
}
