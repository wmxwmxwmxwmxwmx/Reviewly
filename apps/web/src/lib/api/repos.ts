import type { RepoAnalyzeContext, Repository, RepositoryAiAnalysis } from "@reviewly/shared"

import { apiFetch } from "./client"

export type SyncReposResult = {
  syncedRepos?: number
  synced?: number
  status: string
  message?: string
}

export type SaveRepoAiAnalysisPayload = {
  content: string
  model?: string
  provider?: string
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

export function saveRepoAiAnalysis(
  repoId: string,
  payload: SaveRepoAiAnalysisPayload,
  signal?: AbortSignal,
) {
  return apiFetch<Repository>(`/api/repos/${repoId}/ai-analysis`, {
    method: "PUT",
    body: JSON.stringify(payload),
    signal,
  })
}

export function saveRepoArchitectureAnalysis(
  repoId: string,
  payload: SaveRepoAiAnalysisPayload,
  signal?: AbortSignal,
) {
  return apiFetch<Repository>(`/api/repos/${repoId}/architecture-analysis`, {
    method: "PUT",
    body: JSON.stringify(payload),
    signal,
  })
}

export function cloneRepo(repoId: string, signal?: AbortSignal) {
  return apiFetch<{ status: string }>(`/api/repos/${repoId}/clone`, {
    method: "POST",
    signal,
  })
}

export type { RepositoryAiAnalysis }
