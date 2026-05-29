import type { DashboardStats } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchDashboard(signal?: AbortSignal) {
  return apiFetch<DashboardStats>("/api/dashboard", { signal })
}
