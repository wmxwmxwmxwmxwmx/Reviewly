"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { fetchDashboard } from "@/lib/api/dashboard"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { PrismApiError } from "@/lib/api/client"
import type { DashboardStats } from "@reviewly/shared"

const REFRESH_MS = 30_000

export function useDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const loadAbortRef = useRef<AbortController | null>(null)
  const requestSeqRef = useRef(0)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    loadAbortRef.current?.abort()
    const ac = new AbortController()
    loadAbortRef.current = ac
    const seq = ++requestSeqRef.current

    if (!opts?.silent) {
      setLoading(true)
    } else {
      setIsValidating(true)
    }
    setError(null)
    try {
      const next = await fetchDashboard(ac.signal)
      if (mounted.current && seq === requestSeqRef.current) {
        setData(next)
      }
    } catch (e: unknown) {
      if (isAbortError(e)) return
      if (mounted.current && seq === requestSeqRef.current) {
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      }
    } finally {
      if (mounted.current && seq === requestSeqRef.current && shouldApplyResult(ac.signal)) {
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
      loadAbortRef.current?.abort()
      window.clearInterval(id)
    }
  }, [load])

  const refetch = useCallback(() => load({ silent: false }), [load])

  return useMemo(
    () => ({ data, loading, isValidating, error, refetch }),
    [data, loading, isValidating, error, refetch],
  )
}
