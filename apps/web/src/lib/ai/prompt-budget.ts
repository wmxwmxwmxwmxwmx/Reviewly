import type { AnalysisFinding } from "@reviewly/shared"

import { sortFindingsForPrompt } from "@/lib/ai/ai-review-consistency"

export type DiffFileLike = {
  path: string
  language: string
  riskLevel: string
  chunks: Array<{
    header: string
    lines: Array<{ type: string; content: string }>
  }>
}

export const PROMPT_BUDGET = {
  maxDiffChars: 24_000,
  maxFiles: 8,
  maxLinesPerFile: 200,
} as const

export type PromptBudget = typeof PROMPT_BUDGET

export function buildBoundedDiffContext(
  files: DiffFileLike[],
  budget: PromptBudget = PROMPT_BUDGET,
): { context: string; charCount: number; truncated: boolean } {
  let charCount = 0
  let truncated = false
  const sections: string[] = []

  for (const file of files.slice(0, budget.maxFiles)) {
    if (charCount >= budget.maxDiffChars) {
      truncated = true
      break
    }

    const lines: string[] = []
    let fileLineCount = 0

    for (const chunk of file.chunks ?? []) {
      if (fileLineCount >= budget.maxLinesPerFile) {
        truncated = true
        break
      }
      if (charCount + chunk.header.length > budget.maxDiffChars) {
        truncated = true
        break
      }
      lines.push(chunk.header)
      charCount += chunk.header.length + 1
      fileLineCount += 1

      for (const line of chunk.lines) {
        if (fileLineCount >= budget.maxLinesPerFile) {
          truncated = true
          break
        }
        const prefix = line.type === "add" ? "+" : line.type === "delete" ? "-" : " "
        const row = `${prefix}${line.content}`
        if (charCount + row.length + 1 > budget.maxDiffChars) {
          truncated = true
          break
        }
        lines.push(row)
        charCount += row.length + 1
        fileLineCount += 1
      }
    }

    if (lines.length === 0) continue

    const section = `文件：${file.path}\n语言：${file.language}\n风险等级：${file.riskLevel}\n${lines.join("\n")}`
    sections.push(section)
  }

  if (files.length > budget.maxFiles) {
    truncated = true
  }

  const context = sections.join("\n\n---\n\n")
  return { context, charCount: context.length, truncated }
}

export function buildFindingsContext(findings: AnalysisFinding[]): string {
  if (findings.length === 0) {
    return "（规则扫描未发现结构化风险项，请仅依据 Diff 做评审。）"
  }

  return sortFindingsForPrompt(findings)
    .map(
      (f) =>
        `- [${f.severity}] ${f.file}:${f.line} ${f.title}\n  ${f.description}\n  修复建议：${f.fixSuggestion}`,
    )
    .join("\n")
}
