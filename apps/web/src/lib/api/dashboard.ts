import type { DashboardStats, WeeklySummaryResponse } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchDashboard(signal?: AbortSignal) {
  return apiFetch<DashboardStats>("/api/dashboard", { signal })
}

export function fetchWeeklySummary(signal?: AbortSignal) {
  return apiFetch<WeeklySummaryResponse>("/api/dashboard/weekly-summary", {
    method: "POST",
    signal,
  })
}
