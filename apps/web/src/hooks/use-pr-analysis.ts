"use client"

import { useCallback, useState } from "react"
import type { AnalysisFinding, AnalysisJob, AnalysisSummary } from "@reviewly/shared"

import {
  loadPersistedAnalysis,
  runPullRequestAnalysis,
} from "@/lib/api/analysis"

export type PrAnalysisInitialState = {
  findings?: AnalysisFinding[]
  latest?: AnalysisSummary | null
  job?: AnalysisJob | null
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

  const loadPersisted = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingPersisted(true)
      try {
        const result = await loadPersistedAnalysis(prId, signal)
        if (result) {
          setLatest(result.latest)
          setFindings(result.findings)
        }
        return result
      } finally {
        setLoadingPersisted(false)
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
      return result
    },
    [prId],
  )

  const reset = useCallback(() => {
    setFindings([])
    setLatest(null)
    setJob(null)
  }, [])

  return {
    findings,
    latest,
    job,
    loadingPersisted,
    loadPersisted,
    runAnalysis,
    reset,
    setFindings,
    setLatest,
    setJob,
  }
}
