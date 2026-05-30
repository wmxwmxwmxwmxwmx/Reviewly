import type { UnifiedFinding } from "@reviewly/shared"

export const FINDINGS_SEVERITY_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
} as const

export const FINDINGS_SEVERITY_LABELS: Record<UnifiedFinding["severity"], string> = {
  critical: "严重",
  high: "高危",
  medium: "中危",
  low: "低危",
}

export function statusLabel(status?: string): string {
  switch (status) {
    case "open":
      return "待处理"
    case "ignored":
      return "已忽略"
    case "resolved":
      return "已处理"
    default:
      return status ?? "—"
  }
}
