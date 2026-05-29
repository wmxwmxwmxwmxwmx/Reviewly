"use client"

import { useEffect, useState } from "react"

import { fetchTeamMembers } from "@/lib/api/team"
import { PrismApiError } from "@/lib/api/client"
import type { TeamMember } from "@reviewly/shared"

export function useTeam() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    fetchTeamMembers(ac.signal)
      .then(setMembers)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  return { members, loading, error }
}
