import type {
  ImportRepositoryResponse,
  RepoAnalyzeContext,
  Repository,
  RepositoryAiAnalysis,
  SyncRepositoriesResponse,
} from "@reviewly/shared"

import { apiFetch } from "./client"

export type SyncReposResult = SyncRepositoriesResponse

export type SaveRepoAiAnalysisPayload = {
  content: string
  model?: string
  provider?: string
}

export function fetchRepos(signal?: AbortSignal) {
  return apiFetch<Repository[]>("/api/repos", { signal })
}

export function syncRepositories(signal?: AbortSignal) {
  return apiFetch<SyncRepositoriesResponse>("/api/repos/sync", {
    method: "POST",
    signal,
  })
}

/** @deprecated Use syncRepositories */
export const syncRepos = syncRepositories

export function importRepository(url: string, signal?: AbortSignal) {
  return apiFetch<ImportRepositoryResponse>("/api/repos/import", {
    method: "POST",
    body: JSON.stringify({ url }),
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
