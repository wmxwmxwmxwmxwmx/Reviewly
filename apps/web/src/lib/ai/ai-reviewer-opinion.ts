import type { AnalysisFinding, AnalysisSummary } from "@reviewly/shared"

export type AiReviewerVerdict = "approve" | "request_changes" | "block" | "pending"

export interface AiReviewerOpinion {
  verdict: AiReviewerVerdict
  verdictLabel: string
  suggestChanges: boolean
  points: string[]
  analysisExcerpt?: string
  llmInsight?: string
  scores: {
    riskScore: number
    securityScore: number
    performanceScore: number
    maintainabilityScore: number
  }
}

const SEVERITY_ORDER: Record<AnalysisFinding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const TYPE_LABELS: Record<AnalysisFinding["type"], string> = {
  security: "安全",
  performance: "性能",
  architecture: "架构",
  maintainability: "可维护性",
}

const VERDICT_LABELS: Record<Exclude<AiReviewerVerdict, "pending">, string> = {
  approve: "建议合并",
  request_changes: "需要修改",
  block: "不建议合并",
}

/** Align badge verdict with the generated AI summary report when possible. */
export function inferVerdictFromSummaryText(text: string): AiReviewerVerdict | null {
  const normalized = text.trim()
  if (!normalized) return null
  if (/不建议合并|阻止合并|不应合并|禁止合并|不可合并|block/i.test(normalized)) {
    return "block"
  }
  if (/需要修改|要求修改|修改后再|有待改进|request\s*changes/i.test(normalized)) {
    return "request_changes"
  }
  if (/建议合并|可以合并|准予合并|建议通过|approve/i.test(normalized)) {
    return "approve"
  }
  return null
}

function applyVerdict(
  verdict: AiReviewerVerdict,
  scores: AiReviewerOpinion["scores"],
  findings: AnalysisFinding[],
): Pick<AiReviewerOpinion, "verdict" | "verdictLabel" | "suggestChanges"> {
  const suggestChanges =
    verdict === "block" ||
    verdict === "request_changes" ||
    findings.some((f) => f.severity === "critical") ||
    (verdict !== "pending" && scores.securityScore < 60 && verdict !== "approve")

  const verdictLabel =
    verdict === "pending" ? "待完成分析" : VERDICT_LABELS[verdict]

  return { verdict, verdictLabel, suggestChanges }
}

function sortFindings(findings: AnalysisFinding[]): AnalysisFinding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.title.localeCompare(b.title),
  )
}

function deriveVerdictFromFindings(findings: AnalysisFinding[]): AiReviewerVerdict {
  const critical = findings.filter((f) => f.severity === "critical").length
  const high = findings.filter((f) => f.severity === "high").length
  const risk = Math.min(100, critical * 25 + high * 12)
  if (risk >= 70) return "block"
  if (risk >= 40 || critical > 0) return "request_changes"
  if (findings.length === 0) return "pending"
  return "approve"
}

function countByType(findings: AnalysisFinding[]) {
  const counts: Record<string, number> = {}
  for (const f of findings) {
    counts[f.type] = (counts[f.type] ?? 0) + 1
  }
  return counts
}

function extractMarkdownBullets(summary: string, max = 4): string[] {
  const lines = summary.split("\n")
  const bullets: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("- ")) {
      bullets.push(trimmed.slice(2).replace(/\*\*/g, "").trim())
    }
    if (bullets.length >= max) break
  }
  return bullets
}

function stripMarkdown(text: string, maxLen: number): string {
  const plain = text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\n+/g, " ")
    .trim()
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain
}

export interface BuildAiReviewerOpinionInput {
  findings: AnalysisFinding[]
  latest?: AnalysisSummary | null
  prTitle?: string
  repoLabel?: string
  prNumber?: number
  fallbackScores?: {
    riskScore?: number
    securityScore?: number
    performanceScore?: number
    maintainabilityScore?: number
  }
  aiSummary?: string
  hasCompletedAnalysis?: boolean
}

export function buildAiReviewerOpinion(input: BuildAiReviewerOpinionInput): AiReviewerOpinion {
  const {
    findings,
    latest,
    prTitle,
    repoLabel,
    prNumber,
    fallbackScores = {},
    aiSummary,
    hasCompletedAnalysis = false,
  } = input

  const scores = {
    riskScore: latest?.riskScore ?? fallbackScores.riskScore ?? 0,
    securityScore: latest?.securityScore ?? fallbackScores.securityScore ?? 0,
    performanceScore: latest?.performanceScore ?? fallbackScores.performanceScore ?? 0,
    maintainabilityScore:
      latest?.maintainabilityScore ?? fallbackScores.maintainabilityScore ?? 0,
  }

  const analyzed = hasCompletedAnalysis || Boolean(latest) || findings.length > 0

  let verdict: AiReviewerVerdict = "pending"
  if (latest?.mergeRecommendation) {
    verdict = latest.mergeRecommendation
  } else if (findings.length > 0) {
    verdict = deriveVerdictFromFindings(findings)
  } else if (analyzed && scores.riskScore > 0) {
    if (scores.riskScore >= 70) verdict = "block"
    else if (scores.riskScore >= 40 || scores.securityScore < 60) verdict = "request_changes"
    else verdict = "approve"
  }

  const summarySource = aiSummary?.trim() || latest?.summary?.trim() || ""
  const fromReport = summarySource ? inferVerdictFromSummaryText(summarySource) : null
  if (fromReport) {
    verdict = fromReport
  }

  let { verdictLabel, suggestChanges } = applyVerdict(verdict, scores, findings)

  const prRef =
    repoLabel && prNumber != null
      ? `${repoLabel} #${prNumber}`
      : prTitle
        ? `「${prTitle.slice(0, 48)}${prTitle.length > 48 ? "…" : ""}」`
        : "本次 PR"

  const points: string[] = []

  if (!analyzed && !aiSummary?.trim()) {
    points.push("尚未对该 PR 运行代码分析，请先执行「分析」以生成基于改动的评审意见。")
    return {
      ...applyVerdict("pending", scores, findings),
      points,
      scores,
      llmInsight: undefined,
    }
  }

  if (!analyzed && aiSummary?.trim()) {
    const reportVerdict = inferVerdictFromSummaryText(aiSummary) ?? "pending"
    return {
      ...applyVerdict(reportVerdict, scores, findings),
      points: [],
      scores,
      llmInsight: stripMarkdown(aiSummary, 320),
    }
  }

  const critical = findings.filter((f) => f.severity === "critical")
  const high = findings.filter((f) => f.severity === "high")
  const byType = countByType(findings)

  points.push(
    `已对 ${prRef} 完成规则扫描：共 ${findings.length} 项发现（严重 ${critical.length} · 高 ${high.length}）。`,
  )

  if (verdict === "approve") {
    points.push("综合风险评分与多维得分，当前改动未发现阻塞合并项。")
  } else if (verdict === "block") {
    points.push(
      `风险评分 ${scores.riskScore} 达到阻断阈值，存在必须在合并前修复的问题。`,
    )
  } else if (verdict === "request_changes") {
    points.push(
      `风险评分 ${scores.riskScore}，建议在合并前处理下列高优先级项。`,
    )
  }

  if (scores.securityScore < 60) {
    const n = byType.security ?? 0
    points.push(
      n > 0
        ? `安全评分 ${scores.securityScore}：检出 ${n} 项安全问题，需优先修复。`
        : `安全评分 ${scores.securityScore} 偏低，请复核鉴权、输入校验与敏感数据处理。`,
    )
  }

  if (scores.performanceScore < 70 && (byType.performance ?? 0) > 0) {
    points.push(
      `性能评分 ${scores.performanceScore}：存在 ${byType.performance} 项性能相关发现，关注热点路径与资源占用。`,
    )
  }

  if (scores.maintainabilityScore < 70 && (byType.architecture ?? 0) + (byType.maintainability ?? 0) > 0) {
    const archN = (byType.architecture ?? 0) + (byType.maintainability ?? 0)
    points.push(
      `架构/可维护性评分 ${scores.maintainabilityScore}：${archN} 项结构或复杂度问题，建议拆分或收敛依赖。`,
    )
  }

  const topFindings = sortFindings(findings).slice(0, 3)
  for (const f of topFindings) {
    const loc = f.file ? `（${f.file}${f.line ? `:${f.line}` : ""}）` : ""
    points.push(
      `[${TYPE_LABELS[f.type]}·${f.severity}] ${f.title}${loc}`,
    )
  }

  if (topFindings.length === 0 && findings.length === 0 && latest?.summary) {
    const fromSummary = extractMarkdownBullets(latest.summary)
    for (const line of fromSummary) {
      if (line && !points.includes(line)) points.push(line)
    }
  }

  const engineBullets = latest?.summary ? extractMarkdownBullets(latest.summary, 2) : []
  const analysisExcerpt =
    engineBullets.length > 0
      ? engineBullets.join("；")
      : latest?.summary
        ? stripMarkdown(latest.summary, 220)
        : undefined

  const llmInsight =
    aiSummary && aiSummary.trim().length > 40
      ? stripMarkdown(aiSummary, 320)
      : undefined

  ;({ verdict, verdictLabel, suggestChanges } = applyVerdict(verdict, scores, findings))

  return {
    verdict,
    verdictLabel,
    suggestChanges,
    points: points.slice(0, 8),
    analysisExcerpt,
    llmInsight,
    scores,
  }
}
