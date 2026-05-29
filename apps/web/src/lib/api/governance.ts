import type { GovernanceRule } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchGovernanceRules(signal?: AbortSignal) {
  return apiFetch<GovernanceRule[]>("/api/governance/rules", { signal })
}

export function fetchGovernanceViolations(signal?: AbortSignal) {
  return apiFetch<GovernanceRule[]>("/api/governance/violations", { signal })
}
