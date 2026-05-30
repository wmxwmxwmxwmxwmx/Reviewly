import type { DashboardActivity } from "@reviewly/shared"

function formatClockTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

/** Single-line label for dashboard activity feed, e.g. "09:20 审批 PR#123". */
export function formatActivityLine(activity: DashboardActivity): string {
  const clock = activity.createdAt
    ? formatClockTime(activity.createdAt)
    : activity.time
  const action = activity.action?.trim() ?? "活动"
  const repo = activity.repo?.trim()
  const suffix = repo ? ` · ${repo}` : ""
  if (clock) return `${clock} ${action}${suffix}`
  return `${action}${suffix}`
}
