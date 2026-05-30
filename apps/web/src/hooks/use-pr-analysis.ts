"use client"

import { useCallback, useRef, useState } from "react"
import type { AnalysisFinding, AnalysisJob, AnalysisSummary } from "@reviewly/shared"
import type { AiPersistedContent } from "@reviewly/shared"

import { PrismApiError } from "@/lib/api/client"
import { isAbortError } from "@/lib/abort-utils"
import {
  loadPersistedAnalysis,
  runPullRequestAnalysis,
} from "@/lib/api/analysis"

export type PrAnalysisInitialState = {
  findings?: AnalysisFinding[]
  latest?: AnalysisSummary | null
  job?: AnalysisJob | null
  aiSummary?: AiPersistedContent | null
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
  const [aiSummary, setAiSummary] = useState<AiPersistedContent | null>(
    initial?.aiSummary ?? null,
  )
  const [loadingPersisted, setLoadingPersisted] = useState(false)
  const [persistError, setPersistError] = useState<string | null>(null)

  const persistGenerationRef = useRef(0)
  const loadAbortRef = useRef<AbortController | null>(null)

  const abortLoad = useCallback(() => {
    loadAbortRef.current?.abort()
    loadAbortRef.current = null
  }, [])

  const loadPersisted = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return null

      const generation = persistGenerationRef.current
      setLoadingPersisted(true)
      setPersistError(null)

      try {
        const result = await loadPersistedAnalysis(prId, signal)
        if (signal?.aborted || generation !== persistGenerationRef.current) {
          return null
        }

        if (result) {
          setLatest(result.latest)
          setFindings(result.findings)
          setAiSummary(result.aiSummary)
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
        if (!signal?.aborted && generation === persistGenerationRef.current) {
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
      persistGenerationRef.current += 1
      abortLoad()

      const result = await runPullRequestAnalysis(prId, options)
      setJob(result.job)
      setLatest(result.latest)
      setFindings(result.findings)
      setPersistError(null)
      return result
    },
    [prId, abortLoad],
  )

  const reset = useCallback(() => {
    setFindings([])
    setLatest(null)
    setJob(null)
    setAiSummary(null)
    setPersistError(null)
  }, [])

  return {
    findings,
    latest,
    job,
    aiSummary,
    loadingPersisted,
    persistError,
    loadPersisted,
    runAnalysis,
    reset,
    abortLoad,
    setFindings,
    setLatest,
    setJob,
    setAiSummary,
  }
}
