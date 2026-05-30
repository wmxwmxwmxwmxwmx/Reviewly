import type { AiPersistedContent, SecurityCenterFinding, SecurityFindingsPage } from "@reviewly/shared"

import { apiFetch } from "./client"
import { postSse } from "./sse-reader"

export type SaveFindingAiPayload = {
  content: string
  model?: string
  provider?: string
}

export interface SecurityStats {
  openFindings: number
  critical: number
  high: number
  medium: number
  low: number
  status: string
}

/** Gateway caps pageSize at 100 (see domain.security_findings_list). */
export const SECURITY_FINDINGS_MAX_PAGE_SIZE = 100

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
  const { signal, pageSize, ...rest } = params
  const cappedPageSize =
    pageSize != null
      ? Math.min(Math.max(1, pageSize), SECURITY_FINDINGS_MAX_PAGE_SIZE)
      : undefined
  return apiFetch<SecurityFindingsPage>(
    `/api/security/findings${buildQuery({ ...rest, pageSize: cappedPageSize })}`,
    { signal },
  )
}

/** Fetch all findings matching filters (paginates until total is exhausted). */
export async function fetchAllSecurityFindings(
  params: Omit<SecurityFindingsQuery, "page"> = {},
): Promise<SecurityFindingsPage["items"]> {
  const { signal, pageSize = SECURITY_FINDINGS_MAX_PAGE_SIZE, ...rest } = params
  const size = Math.min(Math.max(1, pageSize), SECURITY_FINDINGS_MAX_PAGE_SIZE)
  const items: SecurityFindingsPage["items"] = []
  let page = 1
  let total = 0

  do {
    const res = await fetchSecurityFindings({ ...rest, page, pageSize: size, signal })
    items.push(...res.items)
    total = res.total
    page += 1
  } while (items.length < total && !signal?.aborted)

  return items
}

export function fetchSecurityStats(signal?: AbortSignal) {
  return apiFetch<SecurityStats>("/api/security/stats", { signal })
}

export function patchSecurityFinding(
  findingId: string,
  body: { aiInsight: AiPersistedContent },
  signal?: AbortSignal,
) {
  return apiFetch<SecurityCenterFinding & { aiInsight?: AiPersistedContent }>(
    `/api/security/findings/${findingId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      signal,
    },
  )
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
  await postSse(
    `/api/security/findings/${findingId}/explain`,
    { stream: true },
    options,
  )
}
