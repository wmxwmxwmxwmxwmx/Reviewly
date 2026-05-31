import type {
  AdoptRepositoryResponse,
  ImportRepositoryResponse,
  OnboardRepositoryResponse,
  RepoAnalysisStatusResponse,
  RepoAnalyzeContext,
  Repository,
  RepositoryAiAnalysis,
  StartRepoAnalyzeResponse,
  SyncRepositoriesResponse,
} from "@reviewly/shared"

import { apiFetch } from "./client"

export type SyncReposResult = SyncRepositoriesResponse

export type RepoListType = "github" | "external" | "all"

export type SaveRepoAiAnalysisPayload = {
  content: string
  model?: string
  provider?: string
}

export function fetchRepos(options?: { type?: RepoListType; signal?: AbortSignal }) {
  const type = options?.type ?? "github"
  const qs = type === "github" ? "" : `?type=${encodeURIComponent(type)}`
  return apiFetch<Repository[]>(`/api/repos${qs}`, { signal: options?.signal })
}

export function syncRepositories(signal?: AbortSignal) {
  return apiFetch<SyncRepositoriesResponse>("/api/repos/sync", {
    method: "POST",
    signal,
  })
}

export function syncMyRepositories(signal?: AbortSignal) {
  return apiFetch<SyncRepositoriesResponse>("/api/repos/sync/me", {
    method: "POST",
    signal,
  })
}

export function syncRepoPullRequests(repoId: string, signal?: AbortSignal) {
  return apiFetch<{ synced: number; created: number; updated: number }>(
    `/api/repos/${repoId}/sync-prs`,
    { method: "POST", signal, noRetry: true },
  )
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

export function removeRepository(repoId: string, signal?: AbortSignal) {
  return apiFetch<{ ok: boolean; id: string }>(`/api/repos/${repoId}`, {
    method: "DELETE",
    signal,
  })
}

export function cloneRepo(repoId: string, signal?: AbortSignal) {
  return apiFetch<{ status: string }>(`/api/repos/${repoId}/clone`, {
    method: "POST",
    signal,
  })
}

export function adoptRepository(repoId: string, signal?: AbortSignal) {
  return apiFetch<AdoptRepositoryResponse>(`/api/repos/${repoId}/adopt`, {
    method: "POST",
    signal,
  })
}

export function onboardRepository(repoId: string, signal?: AbortSignal) {
  return apiFetch<OnboardRepositoryResponse>("/api/repos/onboard", {
    method: "POST",
    body: JSON.stringify({ repoId }),
    signal,
  })
}

export type StartRepoAnalyzePayload = {
  types?: Array<"architecture" | "security" | "performance" | "repo_ai">
}

export function startRepoAnalyze(
  repoId: string,
  payload?: StartRepoAnalyzePayload,
  signal?: AbortSignal,
) {
  return apiFetch<StartRepoAnalyzeResponse>(`/api/repos/${repoId}/analyze`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
    signal,
  })
}

export function fetchRepoAnalysisStatus(repoId: string, signal?: AbortSignal) {
  return apiFetch<RepoAnalysisStatusResponse>(`/api/repos/${repoId}/analysis-status`, {
    signal,
    silentStatuses: [404],
  })
}

export function refreshRepoClone(repoId: string, signal?: AbortSignal) {
  return apiFetch<{ ok: boolean; lastCommitSha?: string }>(`/api/repos/${repoId}/refresh`, {
    method: "POST",
    signal,
  })
}

export function cancelRepoJob(
  repoId: string,
  jobId: string,
  signal?: AbortSignal,
) {
  return apiFetch<{ ok: boolean }>(`/api/repos/${repoId}/cancel-job`, {
    method: "POST",
    body: JSON.stringify({ jobId }),
    signal,
  })
}

export type { RepositoryAiAnalysis }
