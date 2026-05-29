import type { DiffFile, PaginatedResponse, PullRequest, PullRequestListItem } from "@reviewly/shared"

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
  return apiFetch<PaginatedResponse<PullRequestListItem>>(
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

export type ImportPullRequestResult = {
  prId: string
  source: "cache" | "github_app" | "github_public" | string
}

export function importPullRequestByUrl(url: string, signal?: AbortSignal) {
  return apiFetch<ImportPullRequestResult>("/api/pull-requests/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  })
}
