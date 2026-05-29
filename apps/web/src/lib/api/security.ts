import type { SecurityCenterFinding, SecurityFindingsPage } from "@reviewly/shared"

import { apiFetch } from "./client"

export interface SecurityStats {
  openFindings: number
  critical: number
  high: number
  medium: number
  low: number
  status: string
}

export interface SecurityFindingsQuery {
  severity?: string
  repo?: string
  q?: string
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

function buildQuery(params: SecurityFindingsQuery): string {
  const qs = new URLSearchParams()
  if (params.severity) qs.set("severity", params.severity)
  if (params.repo) qs.set("repo", params.repo)
  if (params.q) qs.set("q", params.q)
  if (params.page) qs.set("page", String(params.page))
  if (params.pageSize) qs.set("pageSize", String(params.pageSize))
  const s = qs.toString()
  return s ? `?${s}` : ""
}

export function fetchSecurityFindings(params: SecurityFindingsQuery = {}) {
  const { signal, ...rest } = params
  return apiFetch<SecurityFindingsPage>(`/api/security/findings${buildQuery(rest)}`, { signal })
}

export function fetchSecurityStats(signal?: AbortSignal) {
  return apiFetch<SecurityStats>("/api/security/stats", { signal })
}

export async function explainSecurityFinding(
  findingId: string,
  options: {
    signal?: AbortSignal
    onDelta: (text: string) => void
    onError?: (message: string) => void
    onDone?: () => void
  },
): Promise<void> {
  const res = await fetch(`/api/security/findings/${findingId}/explain`, {
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
