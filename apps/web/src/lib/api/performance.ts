import type { AnalysisFinding } from "@reviewly/shared"

import { apiFetch } from "./client"

export interface PerformanceStats {
  openFindings: number
  avgImpact: string
  status: string
}

export function fetchPerformanceStats(signal?: AbortSignal) {
  return apiFetch<PerformanceStats>("/api/performance/stats", { signal })
}

export function fetchPerformanceFindings(signal?: AbortSignal) {
  return apiFetch<AnalysisFinding[]>("/api/performance/findings", { signal })
}
