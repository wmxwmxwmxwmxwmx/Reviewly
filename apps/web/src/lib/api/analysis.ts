import type { AnalysisFinding, AnalysisJob, AnalysisSummary } from "@reviewly/shared"

import { apiFetch } from "./client"

export function startAnalysis(prId: string) {
  return apiFetch<{ jobId: string }>(`/api/pull-requests/${prId}/analysis`, { method: "POST" })
}

export function fetchAnalysisJob(jobId: string, signal?: AbortSignal) {
  return apiFetch<AnalysisJob>(`/api/analysis/jobs/${jobId}`, { signal })
}

export function fetchLatestAnalysis(prId: string, signal?: AbortSignal) {
  return apiFetch<AnalysisSummary>(`/api/pull-requests/${prId}/analysis/latest`, { signal })
}

export function fetchFindings(prId: string, signal?: AbortSignal) {
  return apiFetch<AnalysisFinding[]>(`/api/pull-requests/${prId}/findings`, { signal })
}
