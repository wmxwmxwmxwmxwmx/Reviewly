import type { AiPersistedContent, PerformanceCenterFinding, PerformanceFindingsPage } from "@reviewly/shared"

import { apiFetch } from "./client"

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

export function fetchPerformanceStats(signal?: AbortSignal) {
  return apiFetch<PerformanceStats>("/api/performance/stats", { signal })
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
  const res = await fetch(`/api/performance/findings/${findingId}/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stream: true }),
    signal: options.signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg =
      typeof err === "object" && err && "detail" in err
        ? String((err as { detail?: { error?: string } }).detail?.error ?? res.statusText)
        : res.statusText
    options.onError?.(msg)
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    options.onError?.("无法读取响应流")
    return
  }

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]") {
          options.onDone?.()
          return
        }
        try {
          const parsed = JSON.parse(data) as { delta?: string; error?: string }
          if (parsed.error) {
            options.onError?.(parsed.error)
            return
          }
          if (parsed.delta) options.onDelta(parsed.delta)
        } catch {
          /* ignore */
        }
      }
    }
  }
  options.onDone?.()
}
