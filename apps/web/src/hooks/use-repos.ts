"use client"

import { useEffect, useState } from "react"

import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { fetchRepos } from "@/lib/api/repos"
import type { Repository } from "@reviewly/shared"

export function useRepos() {
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    fetchRepos({ signal: ac.signal })
      .then(setRepos)
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => {
        if (shouldApplyResult(ac.signal)) setLoading(false)
      })

    return () => ac.abort()
  }, [])

  return { repos, loading, error }
}
