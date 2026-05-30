import type { ArchitectureGraph } from "@reviewly/shared"

import { apiFetch } from "./client"
import { postSse } from "./sse-reader"

export type { ArchitectureGraph }
export type ArchitectureNode = ArchitectureGraph["nodes"][number]
export type ArchitectureEdge = ArchitectureGraph["edges"][number]
export type ArchitectureScanMetrics = NonNullable<ArchitectureGraph["metrics"]>

export function fetchArchitectureGraph(repoId: string, signal?: AbortSignal) {
  return apiFetch<ArchitectureGraph>(`/api/architecture/repos/${repoId}/graph`, { signal })
}

export function postArchitectureScan(repoId: string, signal?: AbortSignal) {
  return apiFetch<ArchitectureGraph>("/api/architecture/scan", {
    method: "POST",
    body: JSON.stringify({ repoId }),
    signal,
  })
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
