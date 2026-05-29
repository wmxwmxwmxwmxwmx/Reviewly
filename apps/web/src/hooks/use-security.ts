"use client"

import { useEffect, useState } from "react"

import { fetchSecurityStats } from "@/lib/api/security"
import { PrismApiError } from "@/lib/api/client"
import type { SecurityStats } from "@/lib/api/security"

/** Stats-only hook for sidebar badges and legacy callers. */
export function useSecurity() {
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    fetchSecurityStats(ac.signal)
      .then(setStats)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  return { stats, loading, error }
}
