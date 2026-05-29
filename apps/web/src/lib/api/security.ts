import type { SecurityFinding } from "@reviewly/shared"

import { apiFetch } from "./client"

export interface SecurityStats {
  openFindings: number
  critical: number
  high: number
  medium: number
  low: number
  status: string
}

export function fetchSecurityFindings(signal?: AbortSignal) {
  return apiFetch<SecurityFinding[]>("/api/security/findings", { signal })
}

export function fetchSecurityStats(signal?: AbortSignal) {
  return apiFetch<SecurityStats>("/api/security/stats", { signal })
}
