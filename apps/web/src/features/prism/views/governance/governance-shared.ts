import type { GovernanceMatchType, GovernanceRule } from "@reviewly/shared"

export const matchTypeLabel: Record<GovernanceMatchType | string, string> = {
  keyword: "关键词",
  file_pattern: "路径",
  finding: "Findings",
  any: "组合",
  missing_tests: "缺少测试",
  large_pr: "超大 PR",
}

export const severityMeta: Record<
  GovernanceRule["severity"],
  { label: string; text: string }
> = {
  critical: { label: "严重", text: "text-risk-critical" },
  high: { label: "高", text: "text-risk-high" },
  medium: { label: "中", text: "text-risk-medium" },
  low: { label: "低", text: "text-ai-blue" },
}

export type GovernanceViolationItem = {
  id?: string
  ruleId?: string
  pullRequestId?: string
  rule?: string
  severity?: string
}
