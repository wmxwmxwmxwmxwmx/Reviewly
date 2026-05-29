import type { GovernanceRule, GovernanceRuleInput } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchGovernanceRules(includeDisabled = false, signal?: AbortSignal) {
  const qs = includeDisabled ? "?includeDisabled=true" : ""
  return apiFetch<GovernanceRule[]>(`/api/governance/rules${qs}`, { signal })
}

export function fetchGovernanceRule(id: string, signal?: AbortSignal) {
  return apiFetch<GovernanceRule>(`/api/governance/rules/${id}`, { signal })
}

export function createGovernanceRule(body: GovernanceRuleInput) {
  return apiFetch<GovernanceRule>("/api/governance/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export function updateGovernanceRule(id: string, body: Partial<GovernanceRuleInput>) {
  return apiFetch<GovernanceRule>(`/api/governance/rules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export function deleteGovernanceRule(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/governance/rules/${id}`, { method: "DELETE" })
}

export function fetchGovernanceViolations(signal?: AbortSignal) {
  return apiFetch<GovernanceRule[]>("/api/governance/violations", { signal })
}

/** Per-PR governance evaluation results (after analysis). */
export function fetchPullRequestGovernance(prId: string, signal?: AbortSignal) {
  return apiFetch<GovernanceRule[]>(`/api/pull-requests/${prId}/governance`, { signal })
}
