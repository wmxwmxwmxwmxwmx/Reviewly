"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { AIProvider } from "@/features/prism/contexts/ai-settings-context"
import { fetchProviderBalance, type ProviderBalanceResponse } from "@/lib/api/models"

const REFRESH_MS = 5 * 60 * 1000

export function useProviderBalance(options: {
  enabled: boolean
  provider: AIProvider
  apiKey: string
  baseUrl: string
}) {
  const { enabled, provider, apiKey, baseUrl } = options
  const [balance, setBalance] = useState<ProviderBalanceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setBalance(null)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)

    try {
      const result = await fetchProviderBalance(
        {
          provider,
          apiKey: apiKey.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
        },
        controller.signal,
      )
      if (!controller.signal.aborted) {
        setBalance(result)
      }
    } catch {
      if (!controller.signal.aborted) {
        setBalance({ available: false, message: "余额查询失败" })
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [apiKey, baseUrl, enabled, provider])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, REFRESH_MS)
    return () => {
      window.clearInterval(timer)
      abortRef.current?.abort()
    }
  }, [refresh])

  return { balance, loading, refresh }
}
