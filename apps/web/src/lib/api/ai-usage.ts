import type { AiUsageSummary } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchAiUsageSummary(period: "month" | "day" = "month", signal?: AbortSignal) {
  return apiFetch<AiUsageSummary>(`/api/ai/usage/summary?period=${period}`, { signal })
}
