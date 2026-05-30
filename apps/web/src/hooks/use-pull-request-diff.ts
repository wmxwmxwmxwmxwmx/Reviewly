"use client"

import { useEffect, useState } from "react"

import { fetchPullRequestDiff } from "@/lib/api/pull-requests"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import type { DiffFile } from "@reviewly/shared"

export function usePullRequestDiff(prId: string | null) {
  const [files, setFiles] = useState<DiffFile[]>([])
  const [loading, setLoading] = useState(Boolean(prId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!prId) {
      setFiles([])
      setLoading(false)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    setError(null)

    fetchPullRequestDiff(prId, ac.signal)
      .then(setFiles)
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
        setFiles([])
      })
      .finally(() => {
        if (shouldApplyResult(ac.signal)) setLoading(false)
      })

    return () => ac.abort()
  }, [prId])

  return { files, loading, error }
}
