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
  const [insightOpen, setInsightOpen] = useState(true)
  const [leftRailOpen, setLeftRailOpen] = useState(true)
  const [mobileSheet, setMobileSheet] = useState<"findings" | "insight" | null>(null)
  const [scrollTarget, setScrollTarget] = useState<FindingScrollTarget | null>(null)
  const [highlightTarget, setHighlightTarget] = useState<FindingScrollTarget | null>(null)

  const jumpToFinding = useCallback((target: FindingScrollTarget) => {
    setScrollTarget(target)
    setHighlightTarget(target)
    setMobileSheet(null)
  }, [])

  useEffect(() => {
    if (!highlightTarget) return
    const timer = window.setTimeout(() => setHighlightTarget(null), 2500)
    return () => window.clearTimeout(timer)
  }, [highlightTarget])

  return {
    insightOpen,
    setInsightOpen,
    leftRailOpen,
    setLeftRailOpen,
    mobileSheet,
    setMobileSheet,
    scrollTarget,
    jumpToFinding,
    highlightTarget,
    toggleInsight: () => setInsightOpen((v) => !v),
  }
}
