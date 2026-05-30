import type { ReviewStatus } from "@reviewly/shared"

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  OPEN: "等待评审",
  IN_REVIEW: "评审中",
  CHANGES_REQUESTED: "待修改",
  APPROVED: "已通过",
  MERGED: "已合并",
  CLOSED: "已关闭",
}

export const REVIEW_STATUS_TABS: { key: ReviewStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "全部" },
  { key: "OPEN", label: "待评审" },
  { key: "IN_REVIEW", label: "评审中" },
  { key: "CHANGES_REQUESTED", label: "待修改" },
  { key: "APPROVED", label: "已通过" },
  { key: "MERGED", label: "已合并" },
  { key: "CLOSED", label: "已关闭" },
]

export function reviewStatusBadgeClass(status: ReviewStatus | undefined): string {
  switch (status) {
    case "OPEN":
      return "bg-ai-blue/15 text-ai-blue border-ai-blue/30"
    case "IN_REVIEW":
      return "bg-amber-400/15 text-amber-300 border-amber-400/30"
    case "CHANGES_REQUESTED":
      return "bg-risk-high/15 text-risk-high border-risk-high/30"
    case "APPROVED":
      return "bg-risk-low/15 text-risk-low border-risk-low/30"
    case "MERGED":
      return "bg-ai-purple/15 text-ai-purple border-ai-purple/30"
    case "CLOSED":
      return "bg-surface-3 text-muted-foreground border-border"
    default:
      return "bg-surface-3 text-muted-foreground border-border"
  }
}
