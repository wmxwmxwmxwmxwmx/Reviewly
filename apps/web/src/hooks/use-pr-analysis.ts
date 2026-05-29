"use client"

import { useCallback, useState } from "react"
import type { AnalysisFinding, AnalysisJob, AnalysisSummary } from "@reviewly/shared"

import {
  loadPersistedAnalysis,
  runPullRequestAnalysis,
} from "@/lib/api/analysis"

export function usePrAnalysis(prId: string) {
  const [findings, setFindings] = useState<AnalysisFinding[]>([])
  const [latest, setLatest] = useState<AnalysisSummary | null>(null)
  const [job, setJob] = useState<AnalysisJob | null>(null)
  const [loadingPersisted, setLoadingPersisted] = useState(false)

  const loadPersisted = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingPersisted(true)
      try {
        const result = await loadPersistedAnalysis(prId, signal)
        if (result) {
          setLatest(result.latest)
          setFindings(result.findings)
        } else {
          setLatest(null)
          setFindings([])
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
