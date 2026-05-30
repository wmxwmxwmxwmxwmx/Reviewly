import type { AiPersistedContent, PerformanceCenterFinding, PerformanceFindingsPage } from "@reviewly/shared"

import { apiFetch } from "./client"
import { postSse } from "./sse-reader"

export type SaveFindingAiPayload = {
  content: string
  model?: string
  provider?: string
}

export interface PerformanceStats {
  openFindings: number
  avgImpact: string
  status: string
}

export interface PerformanceFindingsQuery {
  severity?: string
  type?: string
  repo?: string
  q?: string
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

function buildQuery(params: PerformanceFindingsQuery): string {
  const qs = new URLSearchParams()
  if (params.severity) qs.set("severity", params.severity)
  if (params.type) qs.set("type", params.type)
  if (params.repo) qs.set("repo", params.repo)
  if (params.q) qs.set("q", params.q)
  if (params.page) qs.set("page", String(params.page))
  if (params.pageSize) qs.set("pageSize", String(params.pageSize))
  const s = qs.toString()
  return s ? `?${s}` : ""
}

export function fetchPerformanceStats(options?: { repo?: string; signal?: AbortSignal }) {
  const qs = options?.repo ? `?repo=${encodeURIComponent(options.repo)}` : ""
  return apiFetch<PerformanceStats>(`/api/performance/stats${qs}`, { signal: options?.signal })
}

export function fetchPerformanceFindings(params: PerformanceFindingsQuery = {}) {
  const { signal, ...rest } = params
  return apiFetch<PerformanceFindingsPage>(`/api/performance/findings${buildQuery(rest)}`, { signal })
}

export function patchPerformanceFinding(
  findingId: string,
  body: { aiOptimization: AiPersistedContent },
  signal?: AbortSignal,
) {
  return apiFetch<PerformanceCenterFinding & { aiOptimization?: AiPersistedContent }>(
    `/api/performance/findings/${findingId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      signal,
    },
  )
}

export async function optimizePerformanceFinding(
  findingId: string,
  options: {
    signal?: AbortSignal
    onDelta: (text: string) => void
    onError?: (message: string) => void
    onDone?: () => void
  },
): Promise<void> {
  await postSse(
    `/api/performance/findings/${findingId}/optimize`,
    { stream: true },
    options,
  )
}
