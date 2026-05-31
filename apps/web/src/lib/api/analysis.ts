import type {
  AnalysisFinding,
  AnalysisJob,
  AnalysisSummary,
  StartAnalysisResponse,
} from "@reviewly/shared"
import type { AiPersistedContent } from "@reviewly/shared"

import { apiFetch, PrismApiError } from "./client"
import { fetchPrAiSummary } from "./ai-chat"

export function startAnalysis(prId: string, options?: { force?: boolean }) {
  const query = options?.force ? "?force=true" : ""
  return apiFetch<StartAnalysisResponse>(`/api/pull-requests/${prId}/analysis${query}`, {
    method: "POST",
  })
}

export function fetchAnalysisJob(jobId: string, signal?: AbortSignal) {
  return apiFetch<AnalysisJob>(`/api/analysis/jobs/${jobId}`, { signal, noRetry: true })
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

const POLL_INTERVAL_MS = 1500
const POLL_MAX_INTERVAL_MS = 3000

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
  let interval = POLL_INTERVAL_MS
  for (;;) {
    const job = await fetchAnalysisJob(jobId, signal)
    onProgress?.(job)

    if (job.status === "completed") {
      return job
    }
    if (job.status === "failed") {
      throw new PrismApiError(job.error ?? "分析任务失败", 500)
    }

    await sleep(interval, signal)
    interval = Math.min(Math.round(interval * 1.5), POLL_MAX_INTERVAL_MS)
  }
}

export type PullRequestAnalysisResult = {
  job: AnalysisJob
  latest: AnalysisSummary
  findings: AnalysisFinding[]
  cacheHit: boolean
  analysisVersion?: string
}

export async function runPullRequestAnalysis(
  prId: string,
  options?: {
    force?: boolean
    onProgress?: (job: AnalysisJob) => void
    signal?: AbortSignal
  },
): Promise<PullRequestAnalysisResult> {
  const start = await startAnalysis(prId, { force: options?.force })

  if (start.cacheHit) {
    const persisted = await loadPersistedAnalysis(prId, options?.signal)
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

  const job = await pollAnalysisJob(start.jobId, options?.onProgress, options?.signal)
  const [latest, findings] = await Promise.all([
    fetchLatestAnalysis(prId, options?.signal),
    fetchFindings(prId, options?.signal),
  ])
  return {
    job,
    latest,
    findings,
    cacheHit: false,
    analysisVersion: start.analysisVersion,
  }
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
