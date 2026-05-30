"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { AnalysisJob } from "@reviewly/shared"

import { isAbortError } from "@/lib/abort-utils"
import {
  loadPersistedAnalysis,
  pollAnalysisJob,
  startAnalysis,
  type PullRequestAnalysisResult,
} from "@/lib/api/analysis"
import { PrismApiError } from "@/lib/api/client"

export function usePrAnalysisJob(prId: string) {
  const [polling, setPolling] = useState(false)
  const [cacheHit, setCacheHit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setPolling(false)
  }, [])

  useEffect(() => () => abort(), [abort])

  const run = useCallback(
    async (options?: {
      force?: boolean
      onProgress?: (job: AnalysisJob) => void
    }): Promise<PullRequestAnalysisResult | null> => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setError(null)
      setCacheHit(false)

      try {
        const start = await startAnalysis(prId, { force: options?.force })
        if (ac.signal.aborted) {
          return null
        }

        if (start.cacheHit) {
          setCacheHit(true)
          const persisted = await loadPersistedAnalysis(prId, ac.signal)
          if (!persisted) {
            throw new PrismApiError("缓存分析结果不可用", 404)
          }
          const job: AnalysisJob = {
            id: start.jobId,
            status: "completed",
            progress: 100,
            chunkIndex: 0,
            chunkTotal: 0,
            phase: "completed",
            cacheHit: true,
            analysisVersion: start.analysisVersion,
            createdAt: new Date().toISOString(),
          }
          return {
            job,
            latest: persisted.latest,
            findings: persisted.findings,
            cacheHit: true,
            analysisVersion: start.analysisVersion,
          }
        }

        setPolling(true)
        const job = await pollAnalysisJob(start.jobId, options?.onProgress, ac.signal)
        const persisted = await loadPersistedAnalysis(prId, ac.signal)
        if (!persisted) {
          throw new PrismApiError("分析已完成但无法加载结果", 500)
        }
        return {
          job,
          latest: persisted.latest,
          findings: persisted.findings,
          cacheHit: false,
          analysisVersion: start.analysisVersion,
        }
      } catch (err) {
        if (isAbortError(err) || ac.signal.aborted) {
          return null
        }
        const message =
          err instanceof PrismApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "分析任务失败"
        setError(message)
        throw err
      } finally {
        if (!ac.signal.aborted) {
          setPolling(false)
        }
      }
    },
    [prId, abort],
  )

  return {
    run,
    polling,
    cacheHit,
    error,
    abort,
  }
}
