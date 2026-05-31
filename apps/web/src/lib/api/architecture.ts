import type { ArchitectureGraph } from "@reviewly/shared"

import { zh } from "@/lib/i18n/zh"
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

export async function streamArchitectureScan(
  repoId: string,
  options: {
    signal?: AbortSignal
    onProgress: (progress: ArchitectureScanProgress) => void
    onError?: (message: string) => void
  },
): Promise<ArchitectureGraph> {
  let completed = false
  let streamError: string | null = null

  try {
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
          if (payload.complete === true) {
            completed = true
          }
        },
        onError: (msg) => {
          streamError = msg
          options.onError?.(msg)
        },
      },
    )
  } catch (e: unknown) {
    if (e instanceof Error && e.message) {
      throw e
    }
    throw new Error(streamError ?? "扫描流中断")
  }

  if (streamError) {
    throw new Error(streamError)
  }
  if (!completed) {
    throw new Error("扫描未完成（连接可能中断），请重试")
  }

  const graph = await fetchArchitectureGraph(repoId, options.signal)
  if (graph.nodes.length === 0) {
    throw new Error(
      graph.scannedAt
        ? zh.architecture.scanEmpty
        : "扫描未返回依赖图（连接可能中断，请重试）",
    )
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
