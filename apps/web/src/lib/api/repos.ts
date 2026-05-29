import type { RepoAnalyzeContext, Repository } from "@reviewly/shared"

import { apiFetch } from "./client"

export type SyncReposResult = {
  syncedRepos?: number
  synced?: number
  status: string
  message?: string
}

export function fetchRepos(signal?: AbortSignal) {
  return apiFetch<Repository[]>("/api/repos", { signal })
}

export function syncRepos(signal?: AbortSignal) {
  return apiFetch<SyncReposResult>("/api/repos/sync", {
    method: "POST",
    signal,
  })
}

export function fetchRepoAnalyzeContext(repoId: string, signal?: AbortSignal) {
  return apiFetch<RepoAnalyzeContext>(`/api/repos/${repoId}/analyze-context`, { signal })
}

export function cloneRepo(repoId: string, signal?: AbortSignal) {
  return apiFetch<{ status: string }>(`/api/repos/${repoId}/clone`, {
    method: "POST",
    signal,
  })
}
