"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchTeamMembers } from "@/lib/api/team"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import type { TeamMember } from "@reviewly/shared"

export function useTeam() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTeamMembers(signal)
      setMembers(data)
    } catch (e: unknown) {
      if (isAbortError(e)) return
      setError(e instanceof PrismApiError ? e.message : "加载失败")
    } finally {
      if (shouldApplyResult(signal)) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const reload = useCallback(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  return { members, loading, error, reload }
}
