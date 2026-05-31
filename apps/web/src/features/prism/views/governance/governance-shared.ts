import type { GovernanceMatchType, GovernanceRule } from "@reviewly/shared"

export const matchTypeLabel: Record<GovernanceMatchType | string, string> = {
  keyword: "关键词",
  file_pattern: "路径",
  finding: "Findings",
  any: "组合",
}

export const severityMeta: Record<
  GovernanceRule["severity"],
  { label: string; badge: string; dot: string }
> = {
  critical: {
    label: "严重",
    badge: "bg-risk-critical/10 text-risk-critical border-risk-critical/25",
    dot: "bg-risk-critical",
  },
  high: {
    label: "高",
    badge: "bg-risk-high/10 text-risk-high border-risk-high/25",
    dot: "bg-risk-high",
  },
  medium: {
    label: "中",
    badge: "bg-risk-medium/10 text-risk-medium border-risk-medium/25",
    dot: "bg-risk-medium",
  },
  low: {
    label: "低",
    badge: "bg-ai-blue/10 text-ai-blue border-ai-blue/25",
    dot: "bg-ai-blue",
  },
}

export type GovernanceViolationItem = {
  id?: string
  ruleId?: string
  pullRequestId?: string
  rule?: string
  severity?: string
}
