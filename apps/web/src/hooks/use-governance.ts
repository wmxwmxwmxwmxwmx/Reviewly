"use client"

import { useCallback, useEffect, useState } from "react"

import {
  createGovernanceRule,
  deleteGovernanceRule,
  fetchGovernanceRules,
  updateGovernanceRule,
} from "@/lib/api/governance"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import type { GovernanceRule, GovernanceRuleInput } from "@reviewly/shared"

export function useGovernance(options?: { includeDisabled?: boolean }) {
  const includeDisabled = options?.includeDisabled ?? true
  const [rules, setRules] = useState<GovernanceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reloadRules = useCallback(
    async (signal?: AbortSignal) => {
      const data = await fetchGovernanceRules(includeDisabled, signal)
      if (shouldApplyResult(signal)) {
        setRules(data)
      }
      return data
    },
    [includeDisabled],
  )

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        await reloadRules(signal)
      } catch (e: unknown) {
        if (isAbortError(e)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      } finally {
        if (shouldApplyResult(signal)) setLoading(false)
      }
    },
    [reloadRules],
  )

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const addRule = useCallback(
    async (input: GovernanceRuleInput) => {
      const created = await createGovernanceRule(input)
      setRules((prev) => (prev.some((r) => r.id === created.id) ? prev : [...prev, created]))
      void reloadRules().catch(() => {
        /* 保存已成功；后台刷新失败时保留乐观更新 */
      })
      return created
    },
    [reloadRules],
  )

  const editRule = useCallback(
    async (id: string, input: Partial<GovernanceRuleInput>) => {
      const updated = await updateGovernanceRule(id, input)
      setRules((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                ...updated,
                enabled:
                  updated.enabled ??
                  (typeof input.enabled === "boolean" ? input.enabled : r.enabled),
              }
            : r,
        ),
      )
      void reloadRules().catch(() => {
        /* 保存已成功；后台刷新失败时保留乐观更新 */
      })
      return updated
    },
    [reloadRules],
  )

  const setRuleEnabled = useCallback(
    async (id: string, enabled: boolean, previousEnabled: boolean) => {
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)))
      try {
        const updated = await updateGovernanceRule(id, { enabled })
        setRules((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, ...updated, enabled: updated.enabled ?? enabled } : r,
          ),
        )
        void reloadRules().catch(() => {
          /* 保存已成功；后台刷新失败时保留乐观更新 */
        })
        return updated
      } catch (e) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, enabled: previousEnabled } : r)),
        )
        throw e
      }
    },
    [reloadRules],
  )

  const removeRule = useCallback(
    async (id: string) => {
      await deleteGovernanceRule(id)
      setRules((prev) => prev.filter((r) => r.id !== id))
      void reloadRules().catch(() => {
        /* 删除已成功；后台刷新失败时保留乐观更新 */
      })
    },
    [reloadRules],
  )

  return {
    rules,
    loading,
    error,
    refetch: load,
    addRule,
    editRule,
    setRuleEnabled,
    removeRule,
  }
}
