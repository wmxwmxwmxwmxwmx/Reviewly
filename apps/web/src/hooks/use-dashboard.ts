"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { fetchDashboard } from "@/lib/api/dashboard"
import { PrismApiError } from "@/lib/api/client"
import type { DashboardStats } from "@reviewly/shared"

const REFRESH_MS = 30_000

export function useDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true)
    } else {
      setIsValidating(true)
    }
    setError(null)
    try {
      const next = await fetchDashboard()
      if (mounted.current) {
        setData(next)
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return
      if (mounted.current) {
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      }
    } finally {
      if (mounted.current) {
        setLoading(false)
        setIsValidating(false)
      }
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void load()
    const id = window.setInterval(() => {
      void load({ silent: true })
    }, REFRESH_MS)
    return () => {
      mounted.current = false
      window.clearInterval(id)
    }
  }, [load])

  const refetch = useCallback(() => load({ silent: false }), [load])

  return { data, loading, isValidating, error, refetch }
}
