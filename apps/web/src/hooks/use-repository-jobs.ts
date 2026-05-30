"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { RepoAnalysisStatusResponse, RepositoryJob } from "@reviewly/shared"

import { fetchRepoAnalysisStatus } from "@/lib/api/repos"
import { isAbortError } from "@/lib/abort-utils"

const TERMINAL = new Set(["success", "failed", "cancelled"])

function isActiveJob(job: RepositoryJob | null | undefined): boolean {
  return Boolean(job && (job.status === "running" || job.status === "pending"))
}

export function useRepositoryJobs(repoId: string | null, enabled = true) {
  const [status, setStatus] = useState<RepoAnalysisStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!repoId || !enabled) return null
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    try {
      const data = await fetchRepoAnalysisStatus(repoId, ac.signal)
      if (!ac.signal.aborted) {
        setStatus(data)
        setError(null)
      }
      return data
    } catch (e: unknown) {
      if (!isAbortError(e) && !ac.signal.aborted) {
        setError(e instanceof Error ? e.message : "加载任务状态失败")
      }
      return null
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [repoId, enabled])

  useEffect(() => {
    if (!repoId || !enabled) {
      setStatus(null)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      const data = await refresh()
      if (cancelled) return
      if (isActiveJob(data?.latest)) {
        timer = setTimeout(() => void poll(), 2000)
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [repoId, enabled, refresh])

  const latest = status?.latest ?? null
  const active = isActiveJob(latest)

  return { status, latest, jobs: status?.jobs ?? [], active, loading, error, refresh }
}
