import type { AiPersistedContent, AnalysisFinding, GovernanceRule } from "@reviewly/shared"

import { parseMergeRecommendation } from "@/lib/ai/ai-reviewer-opinion"

/** Bump when system/user prompt contract changes — invalidates cached LLM summaries. */
export const AI_REVIEW_PROMPT_VERSION = "2026-05-v1"

/** PR 评审摘要使用 temperature=0，降低同输入下的措辞漂移。 */
export const AI_REVIEW_TEMPERATURE = 0

export const AI_REVIEW_MAX_OUTPUT_TOKENS = 4096

export const AI_REVIEW_MAX_VALIDATION_ATTEMPTS = 2

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const REQUIRED_SECTIONS = ["评审结论", "风险等级", "关键发现"] as const

export function sortFindingsForPrompt(findings: AnalysisFinding[]): AnalysisFinding[] {
  return [...findings].sort((a, b) => {
    const severityDelta =
      (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
    if (severityDelta !== 0) return severityDelta
    const fileDelta = a.file.localeCompare(b.file)
    if (fileDelta !== 0) return fileDelta
    if (a.line !== b.line) return a.line - b.line
    return a.id.localeCompare(b.id)
  })
}

export function sortGovernanceRulesForPrompt(rules: GovernanceRule[]): GovernanceRule[] {
  return [...rules].sort((a, b) => a.id.localeCompare(b.id))
}

export function isAiSummaryStale(
  summary: AiPersistedContent | null | undefined,
  analysisVersion: string | null | undefined,
): boolean {
  if (!summary?.content?.trim()) return false
  if (!analysisVersion) return false
  if (!summary.analysisVersion) return true
  if (summary.analysisVersion !== analysisVersion) return true
  if (summary.promptVersion && summary.promptVersion !== AI_REVIEW_PROMPT_VERSION) {
    return true
  }
  if (!summary.promptVersion) return true
  return false
}

export function validateAiReviewReport(content: string): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []
  const trimmed = content.trim()

  if (!trimmed) {
    return { valid: false, issues: ["报告为空"] }
  }

  if (!parseMergeRecommendation(trimmed)) {
    issues.push("缺少可识别的「合并建议」四枚举（建议合并 / 需要人工重点检查 / 需要修改 / 不建议合并）")
  }

  for (const heading of REQUIRED_SECTIONS) {
    if (!new RegExp(`^##\\s*${heading}\\s*$`, "im").test(trimmed)) {
      issues.push(`缺少章节「${heading}」`)
    }
  }

  if (!/^#\s*AI评审结果/m.test(trimmed)) {
    issues.push("缺少一级标题「# AI评审结果」")
  }

  return { valid: issues.length === 0, issues }
}

export function buildAiReviewRepairUserMessage(issues: string[]): string {
  return [
    "上一轮输出未通过格式校验，请严格按 system prompt 的 Markdown 模板重新输出**完整**报告。",
    "",
    "校验问题：",
    ...issues.map((issue) => `- ${issue}`),
    "",
    "要求：",
    "- 必须包含 # AI评审结果 及全部 ## 章节",
    "- ## 评审结论 中必须有一行「合并建议：」且仅使用四枚举之一",
    "- 禁止省略章节；禁止只输出片段",
  ].join("\n")
}
