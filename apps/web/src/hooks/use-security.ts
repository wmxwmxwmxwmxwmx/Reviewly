"use client"

import { useEffect, useState } from "react"

import { fetchSecurityFindings, fetchSecurityStats } from "@/lib/api/security"
import { PrismApiError } from "@/lib/api/client"
import type { SecurityFinding } from "@reviewly/shared"
import type { SecurityStats } from "@/lib/api/security"

export function useSecurity() {
  const [findings, setFindings] = useState<SecurityFinding[]>([])
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    Promise.all([fetchSecurityFindings(ac.signal), fetchSecurityStats(ac.signal)])
      .then(([f, s]) => {
        setFindings(f)
        setStats(s)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  return { findings, stats, loading, error }
}
