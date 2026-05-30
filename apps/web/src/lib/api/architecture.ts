import type { ArchitectureGraph } from "@reviewly/shared"

import { apiFetch } from "./client"
import { postSse } from "./sse-reader"

export type { ArchitectureGraph }
export type ArchitectureNode = ArchitectureGraph["nodes"][number]
export type ArchitectureEdge = ArchitectureGraph["edges"][number]
export type ArchitectureScanMetrics = NonNullable<ArchitectureGraph["metrics"]>

export type ArchitectureScanProgress = {
  phase: string
  percent: number
  message: string
  current?: number
  total?: number
}

export function fetchArchitectureGraph(repoId: string, signal?: AbortSignal) {
  return apiFetch<ArchitectureGraph>(`/api/architecture/repos/${repoId}/graph`, { signal })
}

export function postArchitectureScan(repoId: string, signal?: AbortSignal) {
  return apiFetch<ArchitectureGraph>("/api/architecture/scan", {
    method: "POST",
    body: JSON.stringify({ repoId, stream: false }),
    signal,
  })
}

export async function streamArchitectureScan(
  repoId: string,
  options: {
    signal?: AbortSignal
    onProgress: (progress: ArchitectureScanProgress) => void
    onError?: (message: string) => void
  },
): Promise<ArchitectureGraph> {
  let graph: ArchitectureGraph | null = null

  await postSse(
    "/api/architecture/scan",
    { repoId, stream: true },
    {
      signal: options.signal,
      onEvent: (payload) => {
        const progress = payload.progress as ArchitectureScanProgress | undefined
        if (progress) {
          options.onProgress(progress)
        }
        if (payload.graph && typeof payload.graph === "object") {
          graph = payload.graph as ArchitectureGraph
        }
      },
      onError: options.onError,
    },
  )

  if (!graph) {
    throw new Error("扫描未返回依赖图")
  }
  return graph
}

export async function streamArchitectureAnalyze(
  repoId: string,
  options: {
    signal?: AbortSignal
    onDelta: (text: string) => void
    onError?: (message: string) => void
    onDone?: () => void
  },
): Promise<void> {
  await postSse(
    `/api/architecture/repos/${repoId}/analyze`,
    { stream: true },
    options,
  )
}
