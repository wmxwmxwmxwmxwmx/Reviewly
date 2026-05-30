import type {
  ApprovalCheckResult,
  PaginatedResponse,
  PullRequest,
  ReviewCenterDashboard,
  ReviewCenterStats,
  ReviewComment,
  ReviewCommentType,
  ReviewStatusCounts,
  ReviewTimelineEvent,
  RepoReviewGroup,
} from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchReviewDashboard(signal?: AbortSignal) {
  return apiFetch<ReviewCenterDashboard>("/api/review-center/dashboard", { signal })
}

export function fetchReviewStats(signal?: AbortSignal) {
  return apiFetch<ReviewCenterStats>("/api/review-center/stats", { signal })
}

export function fetchReviewStatusCounts(repoId?: string, signal?: AbortSignal) {
  const qs = repoId ? `?repoId=${encodeURIComponent(repoId)}` : ""
  return apiFetch<ReviewStatusCounts>(`/api/review-center/status-counts${qs}`, { signal })
}

export function fetchReviewRepoGroups(signal?: AbortSignal) {
  return apiFetch<{ groups: RepoReviewGroup[] }>("/api/review-center/repo-groups", { signal })
}

export function fetchReviewComments(prId: string, signal?: AbortSignal) {
  return apiFetch<{ items: ReviewComment[] }>(
    `/api/review-center/pull-requests/${prId}/comments`,
    { signal },
  )
}

export function postReviewComment(
  prId: string,
  body: { type: ReviewCommentType; content: string },
  signal?: AbortSignal,
) {
  return apiFetch<ReviewComment>(`/api/review-center/pull-requests/${prId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  })
}

export function fetchReviewTimeline(prId: string, signal?: AbortSignal) {
  return apiFetch<{ items: ReviewTimelineEvent[] }>(
    `/api/review-center/pull-requests/${prId}/timeline`,
    { signal },
  )
}

export function fetchApprovalCheck(prId: string, signal?: AbortSignal) {
  return apiFetch<ApprovalCheckResult>(
    `/api/review-center/pull-requests/${prId}/approval-check`,
    { signal },
  )
}

export function fetchPullRequestsWithCounts(
  params?: Record<string, string | undefined>,
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) qs.set(k, v)
    }
  }
  qs.set("includeCounts", "true")
  const q = qs.toString()
  return apiFetch<
    PaginatedResponse<PullRequest> & { statusCounts?: ReviewStatusCounts }
  >(`/api/pull-requests?${q}`, { signal })
}
