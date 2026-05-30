import type { FindingsPage, FindingCategory, UnifiedFinding } from "@reviewly/shared"

import { apiFetch } from "./client"

export type FindingsQuery = {
  type?: FindingCategory
  severity?: string
  repo?: string
  repoId?: string
  status?: string
  q?: string
  page?: number
  pageSize?: number
  sort?: "createdAt" | "severity"
  signal?: AbortSignal
}

function buildQuery(params: FindingsQuery): string {
  const qs = new URLSearchParams()
  if (params.type) qs.set("type", params.type)
  if (params.severity) qs.set("severity", params.severity)
  if (params.repo) qs.set("repo", params.repo)
  if (params.repoId) qs.set("repoId", params.repoId)
  if (params.status) qs.set("status", params.status)
  if (params.q) qs.set("q", params.q)
  if (params.page) qs.set("page", String(params.page))
  if (params.pageSize) qs.set("pageSize", String(params.pageSize))
  if (params.sort) qs.set("sort", params.sort)
  const s = qs.toString()
  return s ? `?${s}` : ""
}

export function fetchFindings(params: FindingsQuery = {}) {
  const { signal, ...rest } = params
  return apiFetch<FindingsPage>(`/api/findings${buildQuery(rest)}`, { signal })
}

export function fetchFinding(id: string, signal?: AbortSignal) {
  return apiFetch<UnifiedFinding>(`/api/findings/${id}`, { signal })
}

export function patchFinding(
  id: string,
  body: { status?: "open" | "ignored" | "resolved"; note?: string },
  signal?: AbortSignal,
) {
  return apiFetch<UnifiedFinding>(`/api/findings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    signal,
  })
}

export function patchFindingStatus(
  id: string,
  status: "open" | "ignored" | "resolved",
  signal?: AbortSignal,
) {
  return patchFinding(id, { status }, signal)
}
