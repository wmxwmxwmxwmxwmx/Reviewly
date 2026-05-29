import type { ArchitectureGraph } from "@reviewly/shared"

import { apiFetch } from "./client"

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
  const res = await fetch(`/api/architecture/repos/${repoId}/analyze`, {
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
          /* ignore malformed chunks */
        }
      }
    }
  }
  options.onDone?.()
}
