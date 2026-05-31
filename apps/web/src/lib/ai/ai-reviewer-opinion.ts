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

const PLACEHOLDER_BULLET =
  /^(严重|高|中|低|总计)[：:]\s*0\s*$|共\s*0\s*项发现|未发现阻塞合并项/i

/** Whether PR-level analysis has real output worth showing in Copilot / task cards. */
export function isPrAnalysisComplete(input: {
  findings: AnalysisFinding[]
  generatedSummary?: string
  latest?: AnalysisSummary | null
  analyzing?: boolean
  restoring?: boolean
}): boolean {
  if (input.analyzing || input.restoring) return false
  return (
    input.findings.length > 0 ||
    Boolean(input.generatedSummary?.trim()) ||
    input.latest?.mergeRecommendation != null
  )
}

/** Align badge verdict with the generated AI summary report when possible. */
export function inferVerdictFromSummaryText(text: string): AiReviewerVerdict | null {
  const normalized = text.trim()
  if (!normalized) return null
  // Block / reject patterns first (must precede approve patterns)
  if (
    /❌\s*不建议合并|不建议合并|存在风险[，,]?\s*不建议合并|不通过|阻止合并|不应合并|禁止合并|不可合并|\bblock\b/i.test(
      normalized,
    )
  ) {
    return "block"
  }
  if (/需要修改|要求修改|修改后再|有待改进|request\s*changes/i.test(normalized)) {
    return "request_changes"
  }
  if (/建议合并|可以合并|准予合并|建议通过|\bapprove\b/i.test(normalized)) {
    return "approve"
  }
  return null
}

/** Parse verdict from the conclusion section of an LLM report (narrow slice). */
export function inferVerdictFromConclusionSection(text: string): AiReviewerVerdict | null {
  const sections = ["评审结论", "结论", "Review Conclusion", "Conclusion"]

  for (const key of sections) {
    const idx = text.indexOf(key)
    if (idx === -1) continue

    const slice = text.slice(idx, idx + 300)
    const v = inferVerdictFromSummaryText(slice)
    if (v) return v
  }

  return null
}

function applyVerdict(
  verdict: AiReviewerVerdict,
  findings: AnalysisFinding[],
): Pick<AiReviewerOpinion, "verdict" | "verdictLabel" | "suggestChanges"> {
  const suggestChanges =
    verdict === "block" ||
    verdict === "request_changes" ||
    findings.some((f) => f.severity === "critical")

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

function extractMarkdownBullets(summary: string, max = 5): string[] {
  const lines = summary.split("\n")
  const bullets: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("- ")) {
      const text = trimmed.slice(2).replace(/\*\*/g, "").trim()
      if (text && !PLACEHOLDER_BULLET.test(text)) {
        bullets.push(text)
      }
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

function buildReasonPoints(input: {
  findings: AnalysisFinding[]
  generatedSummary?: string
  latest?: AnalysisSummary | null
  prRef: string
}): string[] {
  const { findings, generatedSummary, latest, prRef } = input
  const points: string[] = []

  if (generatedSummary?.trim()) {
    const fromLlm = extractMarkdownBullets(generatedSummary, 5)
    if (fromLlm.length > 0) return fromLlm
  }

  if (findings.length > 0) {
    const critical = findings.filter((f) => f.severity === "critical").length
    const high = findings.filter((f) => f.severity === "high").length
    points.push(
      `已对 ${prRef} 完成规则扫描：共 ${findings.length} 项发现（严重 ${critical} · 高 ${high}）。`,
    )
    for (const f of sortFindings(findings).slice(0, 3)) {
      const loc = f.file ? `（${f.file}${f.line ? `:${f.line}` : ""}）` : ""
      points.push(`[${TYPE_LABELS[f.type]}·${f.severity}] ${f.title}${loc}`)
    }
    return points.slice(0, 5)
  }

  if (latest?.summary?.trim()) {
    const fromSummary = extractMarkdownBullets(latest.summary, 5)
    if (fromSummary.length > 0) return fromSummary
  }

  return points
}

export interface BuildAiReviewerOpinionInput {
  findings: AnalysisFinding[]
  latest?: AnalysisSummary | null
  prTitle?: string
  repoLabel?: string
  prNumber?: number
  generatedSummary?: string
  hasCompletedAnalysis?: boolean
}

export function buildAiReviewerOpinion(input: BuildAiReviewerOpinionInput): AiReviewerOpinion {
  const {
    findings,
    latest,
    prTitle,
    repoLabel,
    prNumber,
    generatedSummary,
    hasCompletedAnalysis = false,
  } = input

  const scores = {
    riskScore: latest?.riskScore ?? 0,
    securityScore: latest?.securityScore ?? 0,
    performanceScore: latest?.performanceScore ?? 0,
    maintainabilityScore: latest?.maintainabilityScore ?? 0,
  }

  const analyzed = hasCompletedAnalysis

  const prRef =
    repoLabel && prNumber != null
      ? `${repoLabel} #${prNumber}`
      : prTitle
        ? `「${prTitle.slice(0, 48)}${prTitle.length > 48 ? "…" : ""}」`
        : "本次 PR"

  if (!analyzed) {
    return {
      ...applyVerdict("pending", findings),
      points: ["请先点击「开始分析」生成基于改动的评审意见。"],
      scores,
      llmInsight: undefined,
    }
  }

  // RULE:
  // If generatedSummary exists, it is the SINGLE source of truth.
  // NEVER override it using mergeRecommendation or findings.
  let verdict: AiReviewerVerdict = "pending"
  const llmSummary = generatedSummary?.trim()

  if (llmSummary) {
    verdict =
      inferVerdictFromSummaryText(llmSummary) ??
      inferVerdictFromConclusionSection(llmSummary) ??
      "pending"
  } else if (latest?.mergeRecommendation) {
    verdict = latest.mergeRecommendation
  } else if (findings.length > 0) {
    verdict = deriveVerdictFromFindings(findings)
  }

  const points = buildReasonPoints({
    findings,
    generatedSummary,
    latest,
    prRef,
  })

  const engineBullets = latest?.summary ? extractMarkdownBullets(latest.summary, 2) : []
  const analysisExcerpt =
    engineBullets.length > 0
      ? engineBullets.join("；")
      : latest?.summary
        ? stripMarkdown(latest.summary, 220)
        : undefined

  const llmInsight =
    generatedSummary && generatedSummary.trim().length > 40
      ? stripMarkdown(generatedSummary, 320)
      : undefined

  const applied = applyVerdict(verdict, findings)

  return {
    ...applied,
    points: points.slice(0, 5),
    analysisExcerpt,
    llmInsight,
    scores,
  }
}
