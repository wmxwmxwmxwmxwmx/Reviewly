import type {
  DiffFile,
  ImportPullRequestResult,
  PaginatedResponse,
  PullRequest,
} from "@reviewly/shared"

import { debugApiError, debugApiLog } from "@/lib/debug-api-log"
import { apiFetch } from "./client"

export function fetchPullRequests(
  params?: Record<string, string | undefined>,
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) qs.set(k, v)
    }
  }
  const q = qs.toString()
  return apiFetch<PaginatedResponse<PullRequest>>(
    `/api/pull-requests${q ? `?${q}` : ""}`,
    { signal },
  )
}

export function fetchPullRequest(id: string, signal?: AbortSignal) {
  return apiFetch<PullRequest>(`/api/pull-requests/${id}`, { signal })
}

export function fetchPullRequestDiff(id: string, signal?: AbortSignal) {
  return apiFetch<DiffFile[]>(`/api/pull-requests/${id}/diff`, { signal })
}

export type { ImportPullRequestResult }

export function importPullRequestByUrl(url: string, signal?: AbortSignal) {
  const requestBody = JSON.stringify({ url })
  debugApiLog("importPullRequestByUrl", {
    url,
    "request body": requestBody,
  })

  return apiFetch<ImportPullRequestResult>("/api/pull-requests/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
    signal,
  }).catch((err) => {
    debugApiError("importPullRequestByUrl", err)
    throw err
  })
}
