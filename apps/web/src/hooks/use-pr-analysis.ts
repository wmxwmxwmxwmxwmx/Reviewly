"use client"

import { useCallback, useState } from "react"
import type { AnalysisFinding, AnalysisJob, AnalysisSummary } from "@reviewly/shared"

import { PrismApiError } from "@/lib/api/client"
import {
  loadPersistedAnalysis,
  runPullRequestAnalysis,
} from "@/lib/api/analysis"

export type PrAnalysisInitialState = {
  findings?: AnalysisFinding[]
  latest?: AnalysisSummary | null
  job?: AnalysisJob | null
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

export function usePrAnalysis(
  prId: string,
  initial?: PrAnalysisInitialState,
) {
  const [findings, setFindings] = useState<AnalysisFinding[]>(
    initial?.findings ?? [],
  )
  const [latest, setLatest] = useState<AnalysisSummary | null>(
    initial?.latest ?? null,
  )
  const [job, setJob] = useState<AnalysisJob | null>(initial?.job ?? null)
  const [loadingPersisted, setLoadingPersisted] = useState(false)
  const [persistError, setPersistError] = useState<string | null>(null)

  const loadPersisted = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return null

      setLoadingPersisted(true)
      setPersistError(null)

      try {
        const result = await loadPersistedAnalysis(prId, signal)
        if (signal?.aborted) return null

        if (result) {
          setLatest(result.latest)
          setFindings(result.findings)
        }
        return result
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) {
          return null
        }
        const message =
          error instanceof PrismApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "加载历史分析失败"
        setPersistError(message)
        throw error
      } finally {
        if (!signal?.aborted) {
          setLoadingPersisted(false)
        }
      }
    },
    [prId],
  )

  const runAnalysis = useCallback(
    async (options?: {
      onProgress?: (job: AnalysisJob) => void
      signal?: AbortSignal
    }) => {
      const result = await runPullRequestAnalysis(prId, options)
      setJob(result.job)
      setLatest(result.latest)
      setFindings(result.findings)
      setPersistError(null)
      return result
    },
    [prId],
  )

  const reset = useCallback(() => {
    setFindings([])
    setLatest(null)
    setJob(null)
    setPersistError(null)
  }, [])

  return {
    findings,
    latest,
    job,
    loadingPersisted,
    persistError,
    loadPersisted,
    runAnalysis,
    reset,
    setFindings,
    setLatest,
    setJob,
  }
}
