"use client"

import { useCallback, useEffect, useState } from "react"

import {
  createGovernanceRule,
  deleteGovernanceRule,
  fetchGovernanceRules,
  updateGovernanceRule,
} from "@/lib/api/governance"
import { PrismApiError } from "@/lib/api/client"
import type { GovernanceRule, GovernanceRuleInput } from "@reviewly/shared"

export function useGovernance(options?: { includeDisabled?: boolean }) {
  const includeDisabled = options?.includeDisabled ?? true
  const [rules, setRules] = useState<GovernanceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchGovernanceRules(includeDisabled, signal)
        setRules(data)
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      } finally {
        setLoading(false)
      }
    },
    [includeDisabled],
  )

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const addRule = useCallback(
    async (input: GovernanceRuleInput) => {
      const created = await createGovernanceRule(input)
      await load()
      return created
    },
    [load],
  )

  const editRule = useCallback(
    async (id: string, input: Partial<GovernanceRuleInput>) => {
      const updated = await updateGovernanceRule(id, input)
      await load()
      return updated
    },
    [load],
  )

  const removeRule = useCallback(
    async (id: string) => {
      await deleteGovernanceRule(id)
      await load()
    },
    [load],
  )

  return {
    rules,
    loading,
    error,
    refetch: load,
    addRule,
    editRule,
    removeRule,
  }
}
