"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchPullRequest } from "@/lib/api/pull-requests"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import type { PullRequest } from "@reviewly/shared"

export function usePullRequest(prId: string | null) {
  const [data, setData] = useState<PullRequest | null>(null)
  const [loading, setLoading] = useState(Boolean(prId))
  const [error, setError] = useState<string | null>(null)
  const [reloadSeq, setReloadSeq] = useState(0)

  const reload = useCallback(() => {
    setReloadSeq((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!prId) {
      setData(null)
      setLoading(false)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    setError(null)

    fetchPullRequest(prId, ac.signal)
      .then((pr) => {
        if (!shouldApplyResult(ac.signal)) return
        setData(pr)
        setError(null)
      })
      .catch((e: unknown) => {
        if (isAbortError(e) || !shouldApplyResult(ac.signal)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
        setData(null)
      })
      .finally(() => {
        if (shouldApplyResult(ac.signal)) setLoading(false)
      })

    return () => ac.abort()
  }, [prId, reloadSeq])

  const patchLocal = useCallback((patch: Partial<PullRequest>) => {
    setData((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  return { data, loading, error, reload, patchLocal }
}
