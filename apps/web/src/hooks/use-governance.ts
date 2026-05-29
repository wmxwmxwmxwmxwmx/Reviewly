"use client"

import { useEffect, useState } from "react"

import { fetchGovernanceRules } from "@/lib/api/governance"
import { PrismApiError } from "@/lib/api/client"
import type { GovernanceRule } from "@reviewly/shared"

export function useGovernance() {
  const [rules, setRules] = useState<GovernanceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    fetchGovernanceRules(ac.signal)
      .then(setRules)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  return { rules, loading, error }
}
