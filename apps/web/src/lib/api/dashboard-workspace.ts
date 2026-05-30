import type {
  AnalysisJobsStats,
  DashboardActivity,
  PaginatedResponse,
  PullRequest,
  RecentActivityResponse,
  Repository,
} from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchAnalysisJobsStats(signal?: AbortSignal) {
  return apiFetch<AnalysisJobsStats>("/api/analysis/jobs/stats", { signal })
}

export function fetchRecentActivity(limit = 20, signal?: AbortSignal) {
  const qs = `?limit=${encodeURIComponent(String(limit))}`
  return apiFetch<RecentActivityResponse>(`/api/pull-requests/recent-activity${qs}`, {
    signal,
  })
}

export function fetchPullRequestsFiltered(
  filter: "assigned" | "high-risk",
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({
    filter,
    includeExternal: "true",
    limit: "1",
  })
  return apiFetch<PaginatedResponse<PullRequest>>(`/api/pull-requests?${qs}`, { signal })
}

export function fetchWorkspaceRepos(signal?: AbortSignal) {
  return apiFetch<Repository[]>("/api/repos?type=all", { signal })
}

export type { DashboardActivity }
