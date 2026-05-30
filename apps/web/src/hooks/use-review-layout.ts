"use client"

import { useCallback, useEffect, useState } from "react"

import type { FindingScrollTarget } from "@/features/prism/lib/map-findings-to-diff"

export type AnalysisPhase = "idle" | "scanning" | "summarizing" | "done" | "error"

export function deriveAnalysisPhase(input: {
  scanning: boolean
  summaryStreaming: boolean
  analysisError: string | null
  hasAnalysis: boolean
}): AnalysisPhase {
  if (input.analysisError) return "error"
  if (input.scanning) return "scanning"
  if (input.summaryStreaming) return "summarizing"
  if (input.hasAnalysis) return "done"
  return "idle"
}

export function useReviewLayout() {
  const [insightOpen, setInsightOpen] = useState(false)
  const [findingsExpanded, setFindingsExpanded] = useState(false)
  const [scrollTarget, setScrollTarget] = useState<FindingScrollTarget | null>(null)
  const [highlightTarget, setHighlightTarget] = useState<FindingScrollTarget | null>(null)

  const jumpToFinding = useCallback((target: FindingScrollTarget) => {
    setScrollTarget(target)
    setHighlightTarget(target)
    setFindingsExpanded(false)
  }, [])

  const openInsight = useCallback(() => setInsightOpen(true), [])
  const closeInsight = useCallback(() => setInsightOpen(false), [])
  const toggleInsight = useCallback(() => setInsightOpen((v) => !v), [])

  useEffect(() => {
    if (!highlightTarget) return
    const timer = window.setTimeout(() => setHighlightTarget(null), 2500)
    return () => window.clearTimeout(timer)
  }, [highlightTarget])

  return {
    insightOpen,
    setInsightOpen,
    openInsight,
    closeInsight,
    toggleInsight,
    findingsExpanded,
    setFindingsExpanded,
    scrollTarget,
    jumpToFinding,
    highlightTarget,
  }
}
