import type { SecurityFinding } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchSecurityFindings(signal?: AbortSignal) {
  return apiFetch<SecurityFinding[]>("/api/security/findings", { signal })
}
