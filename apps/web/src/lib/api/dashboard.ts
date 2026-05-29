import type { DashboardStats, WeeklySummaryResponse } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchDashboard(signal?: AbortSignal) {
  return apiFetch<DashboardStats>("/api/dashboard", { signal })
}

export function fetchWeeklySummary(apiKey?: string, signal?: AbortSignal) {
  const body =
    apiKey && apiKey.trim().length > 0 ? JSON.stringify({ apiKey: apiKey.trim() }) : "{}"
  return apiFetch<WeeklySummaryResponse>("/api/dashboard/weekly-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  })
}
