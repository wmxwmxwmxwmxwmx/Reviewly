import type { AnalysisFinding, AnalysisJob, AnalysisSummary } from "@reviewly/shared"
import type { AiPersistedContent } from "@reviewly/shared"

import { apiFetch, PrismApiError } from "./client"
import { fetchPrAiSummary } from "./ai-chat"

export function startAnalysis(prId: string) {
  return apiFetch<{ jobId: string }>(`/api/pull-requests/${prId}/analysis`, { method: "POST" })
}

export function fetchAnalysisJob(jobId: string, signal?: AbortSignal) {
  return apiFetch<AnalysisJob>(`/api/analysis/jobs/${jobId}`, { signal })
}

export function fetchLatestAnalysis(prId: string, signal?: AbortSignal) {
  return apiFetch<AnalysisSummary>(`/api/pull-requests/${prId}/analysis/latest`, { signal })
}

async function fetchLatestAnalysisOptional(
  prId: string,
  signal?: AbortSignal,
): Promise<AnalysisSummary | null> {
  try {
    return await apiFetch<AnalysisSummary>(`/api/pull-requests/${prId}/analysis/latest`, {
      signal,
      silentStatuses: [404],
    })
  } catch (error) {
    if (error instanceof PrismApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

export function fetchFindings(prId: string, signal?: AbortSignal) {
  return apiFetch<AnalysisFinding[]>(`/api/pull-requests/${prId}/findings`, { signal })
}

const POLL_INTERVAL_MS = 600

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      },
      { once: true },
    )
  })
}

export async function pollAnalysisJob(
  jobId: string,
  onProgress?: (job: AnalysisJob) => void,
  signal?: AbortSignal,
): Promise<AnalysisJob> {
  for (;;) {
    const job = await fetchAnalysisJob(jobId, signal)
    onProgress?.(job)

    if (job.status === "completed") {
      return job
    }
    if (job.status === "failed") {
      throw new PrismApiError(job.error ?? "分析任务失败", 500)
    }

    await sleep(POLL_INTERVAL_MS, signal)
  }
}

export async function runPullRequestAnalysis(
  prId: string,
  options?: {
    onProgress?: (job: AnalysisJob) => void
    signal?: AbortSignal
  },
): Promise<{ job: AnalysisJob; latest: AnalysisSummary; findings: AnalysisFinding[] }> {
  const { jobId } = await startAnalysis(prId)
  const job = await pollAnalysisJob(jobId, options?.onProgress, options?.signal)
  const [latest, findings] = await Promise.all([
    fetchLatestAnalysis(prId, options?.signal),
    fetchFindings(prId, options?.signal),
  ])
  return { job, latest, findings }
}

/** Load persisted analysis; returns null when none exists (404). */
export async function loadPersistedAnalysis(
  prId: string,
  signal?: AbortSignal,
): Promise<{
  latest: AnalysisSummary
  findings: AnalysisFinding[]
  aiSummary: AiPersistedContent | null
} | null> {
  const latest = await fetchLatestAnalysisOptional(prId, signal)
  if (!latest) {
    return null
  }

  const [findings, aiSummary] = await Promise.all([
    fetchFindings(prId, signal),
    fetchPrAiSummary(prId, signal).catch(() => null),
  ])
  return { latest, findings, aiSummary }
}
