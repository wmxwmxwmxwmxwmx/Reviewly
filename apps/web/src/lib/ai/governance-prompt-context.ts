import type { GovernanceRule } from "@reviewly/shared"

const SEVERITY_LABEL: Record<string, string> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
}

export function buildGovernancePromptContext(rules: GovernanceRule[]): string {
  if (rules.length === 0) {
    return "（暂无工程治理规则或未执行治理检查）"
  }

  return rules
    .map((rule) => {
      const evaluated = rule.evaluatedAt != null || rule.violated !== undefined
      const status = !evaluated
        ? "待扫描"
        : rule.violated
          ? "违反"
          : "通过"
      const severity = SEVERITY_LABEL[rule.severity ?? "medium"] ?? rule.severity ?? "medium"
      const lines = [
        `规则：${rule.rule}`,
        `严重级别：${severity}`,
        `状态：${status}`,
        rule.file ? `文件：${rule.file}` : null,
        rule.feedback ? `说明：${rule.feedback}` : null,
      ].filter(Boolean)
      return lines.join("\n")
    })
    .join("\n\n")
}

export function hasGovernanceViolations(rules: GovernanceRule[]): boolean {
  return rules.some((r) => r.violated === true)
}
