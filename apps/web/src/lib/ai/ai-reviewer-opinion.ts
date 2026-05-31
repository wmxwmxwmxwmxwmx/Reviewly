import type { AnalysisFinding, AnalysisSummary, GovernanceRule } from "@reviewly/shared"

export type AiReviewerVerdict = "approve" | "request_changes" | "block" | "pending"

export type MergeRecommendationLabel =
  | "建议合并"
  | "需要人工重点检查"
  | "需要修改"
  | "不建议合并"

export interface ParsedSummarySections {
  riskLevel?: string
  keyFindings: string[]
  logicReview: string[]
  businessReview: string[]
  codeQualityReview: string[]
  styleReview: string[]
  riskPropagation: string[]
  reviewerChecks: string[]
  reviewComments: string[]
  governanceCheck: string[]
  reviewSuggestions: string[]
  reason?: string
}

export interface AiReviewerOpinion {
  verdict: AiReviewerVerdict
  verdictLabel: MergeRecommendationLabel | string
  suggestChanges: boolean
  points: string[]
  analysisExcerpt?: string
  llmInsight?: string
  conclusionReason?: string
  parsedSections?: ParsedSummarySections
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

const MERGE_LABEL_TO_VERDICT: Record<MergeRecommendationLabel, AiReviewerVerdict> = {
  建议合并: "approve",
  需要人工重点检查: "request_changes",
  需要修改: "request_changes",
  不建议合并: "block",
}

const MERGE_RECOMMENDATION_PATTERN =
  /合并建议[：:]\s*(建议合并|需要人工重点检查|需要修改|不建议合并)/

const PLACEHOLDER_BULLET =
  /^(严重|高|中|低|总计)[：:]\s*0\s*$|共\s*0\s*项发现|未发现阻塞合并项|未发现显著风险/i

const STRUCTURED_SECTION_MARKERS =
  /问题[：:]|原因[：:]|影响[：:]|建议[：:]|Review Comment[：:]|风险传播链[：:]|Reviewer思考过程[：:]/i

const SECTION_PLACEHOLDER = "未发现明显问题"

const GOVERNANCE_SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

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

function extractSection(text: string, heading: string): string | undefined {
  const pattern = new RegExp(`^##\\s*${heading}\\s*$`, "im")
  const match = pattern.exec(text)
  if (!match) return undefined
  const start = match.index + match[0].length
  const rest = text.slice(start)
  const nextHeading = rest.search(/^##\s/m)
  const body = (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim()
  return body || undefined
}

function extractBullets(section: string | undefined, max = 5): string[] {
  if (!section) return []
  const bullets: string[] = []
  for (const line of section.split("\n")) {
    const trimmed = line.trim()
    const bullet = trimmed.match(/^[-*]\s+(.+)/)
    if (bullet?.[1]) {
      const text = bullet[1].replace(/\*\*/g, "").trim()
      if (text && !PLACEHOLDER_BULLET.test(text)) {
        bullets.push(text)
      }
    }
    if (bullets.length >= max) break
  }
  return bullets
}

function extractReasonFromConclusion(section: string | undefined): string | undefined {
  if (!section) return undefined
  const reasonMatch = section.match(/理由[：:]\s*([\s\S]+)/)
  if (reasonMatch?.[1]) {
    return reasonMatch[1].trim().split("\n")[0]?.trim()
  }
  return undefined
}

/** Preserves root-cause / Review Comment / propagation blocks as full paragraphs. */
export function sectionToDisplayItems(
  section: string | undefined,
  max: number,
  emptyFallback: string = SECTION_PLACEHOLDER,
): string[] {
  if (!section?.trim()) {
    return [emptyFallback]
  }

  const body = section.trim()

  if (STRUCTURED_SECTION_MARKERS.test(body)) {
    const parts = body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0) {
      return [emptyFallback]
    }
    return parts.slice(0, max)
  }

  const bullets = extractBullets(body, max)
  if (bullets.length > 0) {
    return bullets
  }

  const firstLine = body.split("\n")[0]?.trim()
  if (firstLine && /未发现明显问题|未发现显著风险|未发现需要在 PR 中单独留言的问题/i.test(firstLine)) {
    return [firstLine]
  }

  return [body]
}

export function parseSummarySections(summary: string): ParsedSummarySections {
  const riskSection = extractSection(summary, "风险等级")
  const findingsSection = extractSection(summary, "关键发现")
  const logicSection = extractSection(summary, "逻辑审查")
  const businessSection = extractSection(summary, "业务逻辑审查")
  const qualitySection = extractSection(summary, "代码质量审查")
  const styleSection = extractSection(summary, "工程规范审查")
  const propagationSection = extractSection(summary, "风险传播分析")
  const reviewerSection = extractSection(summary, "Reviewer重点确认项")
  const reviewCommentsSection = extractSection(summary, "建议Review Comment")
  const governanceSection = extractSection(summary, "工程治理检查")
  const reviewSection = extractSection(summary, "Review建议")
  const conclusionSection = extractSection(summary, "评审结论")

  const riskLevel = riskSection?.split("\n")[0]?.trim().replace(/\*\*/g, "")

  let reviewSuggestions = extractBullets(reviewSection, 5)
  if (reviewSuggestions.length === 0 && reviewSection) {
    reviewSuggestions = reviewSection
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("Reviewer") && !/^建议确认[：:]\s*$/.test(l))
      .slice(0, 5)
  }
  if (reviewSuggestions.length === 0) {
    reviewSuggestions = [SECTION_PLACEHOLDER]
  }

  const keyFindings = sectionToDisplayItems(findingsSection, 5, "未发现显著风险")

  return {
    riskLevel: riskLevel || undefined,
    keyFindings,
    logicReview: sectionToDisplayItems(logicSection, 5),
    businessReview: sectionToDisplayItems(businessSection, 5),
    codeQualityReview: sectionToDisplayItems(qualitySection, 5),
    styleReview: sectionToDisplayItems(styleSection, 5),
    riskPropagation: sectionToDisplayItems(propagationSection, 5),
    reviewerChecks: sectionToDisplayItems(reviewerSection, 5),
    reviewComments: sectionToDisplayItems(reviewCommentsSection, 3),
    governanceCheck: sectionToDisplayItems(governanceSection, 8),
    reviewSuggestions,
    reason: extractReasonFromConclusion(conclusionSection),
  }
}

export function parseMergeRecommendation(text: string): {
  label: MergeRecommendationLabel
  verdict: AiReviewerVerdict
} | null {
  const conclusion = extractSection(text, "评审结论") ?? text
  const match = MERGE_RECOMMENDATION_PATTERN.exec(conclusion)
  if (match?.[1]) {
    const label = match[1] as MergeRecommendationLabel
    return { label, verdict: MERGE_LABEL_TO_VERDICT[label] }
  }
  const fullMatch = MERGE_RECOMMENDATION_PATTERN.exec(text)
  if (fullMatch?.[1]) {
    const label = fullMatch[1] as MergeRecommendationLabel
    return { label, verdict: MERGE_LABEL_TO_VERDICT[label] }
  }
  return null
}

/** @deprecated Prefer parseMergeRecommendation */
export function inferVerdictFromSummaryText(text: string): AiReviewerVerdict | null {
  const parsed = parseMergeRecommendation(text)
  if (parsed) return parsed.verdict
  const normalized = text.trim()
  if (!normalized) return null
  if (
    /❌\s*不建议合并|不建议合并|存在风险[，,]?\s*不建议合并|不通过|阻止合并|不应合并|禁止合并|不可合并|\bblock\b/i.test(
      normalized,
    )
  ) {
    return "block"
  }
  if (/需要人工重点检查/.test(normalized)) return "request_changes"
  if (/需要修改|要求修改|修改后再|有待改进|request\s*changes/i.test(normalized)) {
    return "request_changes"
  }
  if (/建议合并|可以合并|准予合并|建议通过|\bapprove\b/i.test(normalized)) {
    return "approve"
  }
  return null
}

/** @deprecated Prefer parseMergeRecommendation */
export function inferVerdictFromConclusionSection(text: string): AiReviewerVerdict | null {
  const section = extractSection(text, "评审结论")
  if (section) {
    const parsed = parseMergeRecommendation(`## 评审结论\n${section}`)
    if (parsed) return parsed.verdict
  }
  for (const key of ["评审结论", "结论", "Review Conclusion", "Conclusion"]) {
    const idx = text.indexOf(key)
    if (idx === -1) continue
    const slice = text.slice(idx, idx + 500)
    const v = inferVerdictFromSummaryText(slice)
    if (v) return v
  }
  return null
}

export function deriveVerdictFromGovernance(
  rules: GovernanceRule[],
): { verdict: AiReviewerVerdict; label: MergeRecommendationLabel } | null {
  const violated = rules.filter((r) => r.violated === true)
  if (violated.length === 0) return null

  let maxRank = 0
  for (const rule of violated) {
    const rank = GOVERNANCE_SEVERITY_RANK[rule.severity ?? "medium"] ?? 2
    maxRank = Math.max(maxRank, rank)
  }

  if (maxRank >= GOVERNANCE_SEVERITY_RANK.high) {
    return { verdict: "block", label: "不建议合并" }
  }
  if (maxRank >= GOVERNANCE_SEVERITY_RANK.medium) {
    return { verdict: "request_changes", label: "需要人工重点检查" }
  }
  return { verdict: "approve", label: "建议合并" }
}

function mergeRecommendationToLabel(rec: AnalysisSummary["mergeRecommendation"]): MergeRecommendationLabel {
  switch (rec) {
    case "approve":
      return "建议合并"
    case "block":
      return "不建议合并"
    case "request_changes":
      return "需要修改"
    default:
      return "建议合并"
  }
}

function applyVerdict(
  verdict: AiReviewerVerdict,
  label: MergeRecommendationLabel | string,
  findings: AnalysisFinding[],
): Pick<AiReviewerOpinion, "verdict" | "verdictLabel" | "suggestChanges"> {
  const suggestChanges =
    verdict === "block" ||
    verdict === "request_changes" ||
    findings.some((f) => f.severity === "critical")

  return { verdict, verdictLabel: label, suggestChanges }
}

function sortFindings(findings: AnalysisFinding[]): AnalysisFinding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.title.localeCompare(b.title),
  )
}

function deriveVerdictFromFindings(findings: AnalysisFinding[]): {
  verdict: AiReviewerVerdict
  label: MergeRecommendationLabel
} {
  const critical = findings.filter((f) => f.severity === "critical").length
  const high = findings.filter((f) => f.severity === "high").length
  const risk = Math.min(100, critical * 25 + high * 12)
  if (risk >= 70) return { verdict: "block", label: "不建议合并" }
  if (risk >= 40 || critical > 0) return { verdict: "request_changes", label: "需要修改" }
  if (findings.length === 0) return { verdict: "approve", label: "建议合并" }
  const medium = findings.some((f) => f.severity === "medium")
  if (medium) return { verdict: "request_changes", label: "需要人工重点检查" }
  return { verdict: "approve", label: "建议合并" }
}

function extractMarkdownBullets(summary: string, max = 5): string[] {
  return extractBullets(summary, max)
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
  parsedSections?: ParsedSummarySections
}): string[] {
  const { findings, generatedSummary, latest, prRef, parsedSections } = input

  if (parsedSections?.keyFindings.length) {
    return parsedSections.keyFindings.slice(0, 5)
  }

  if (generatedSummary?.trim()) {
    const fromLlm = extractMarkdownBullets(generatedSummary, 5)
    if (fromLlm.length > 0) return fromLlm
  }

  if (findings.length > 0) {
    const critical = findings.filter((f) => f.severity === "critical").length
    const high = findings.filter((f) => f.severity === "high").length
    const points: string[] = [
      `已对 ${prRef} 完成规则扫描：共 ${findings.length} 项发现（严重 ${critical} · 高 ${high}）。`,
    ]
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

  return []
}

export interface BuildAiReviewerOpinionInput {
  findings: AnalysisFinding[]
  latest?: AnalysisSummary | null
  prTitle?: string
  repoLabel?: string
  prNumber?: number
  generatedSummary?: string
  hasCompletedAnalysis?: boolean
  governanceRules?: GovernanceRule[]
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
    governanceRules = [],
  } = input

  const scores = {
    riskScore: latest?.riskScore ?? 0,
    securityScore: latest?.securityScore ?? 0,
    performanceScore: latest?.performanceScore ?? 0,
    maintainabilityScore: latest?.maintainabilityScore ?? 0,
  }

  const prRef =
    repoLabel && prNumber != null
      ? `${repoLabel} #${prNumber}`
      : prTitle
        ? `「${prTitle.slice(0, 48)}${prTitle.length > 48 ? "…" : ""}」`
        : "本次 PR"

  const llmSummary = generatedSummary?.trim()
  const parsedSections = llmSummary ? parseSummarySections(llmSummary) : undefined

  if (!hasCompletedAnalysis) {
    return {
      verdict: "pending",
      verdictLabel: "待完成分析",
      suggestChanges: false,
      points: [],
      scores,
      parsedSections,
    }
  }

  let verdict: AiReviewerVerdict = "approve"
  let label: MergeRecommendationLabel = "建议合并"

  const parsedMerge = llmSummary ? parseMergeRecommendation(llmSummary) : null
  if (parsedMerge) {
    verdict = parsedMerge.verdict
    label = parsedMerge.label
  } else {
    const fromGov = deriveVerdictFromGovernance(governanceRules)
    if (fromGov) {
      verdict = fromGov.verdict
      label = fromGov.label
    } else if (latest?.mergeRecommendation) {
      verdict = latest.mergeRecommendation
      label = mergeRecommendationToLabel(latest.mergeRecommendation)
    } else if (findings.length > 0) {
      const fromFindings = deriveVerdictFromFindings(findings)
      verdict = fromFindings.verdict
      label = fromFindings.label
    }
  }

  if (verdict === "pending") {
    verdict = "approve"
    label = "建议合并"
  }

  const points = buildReasonPoints({
    findings,
    generatedSummary,
    latest,
    prRef,
    parsedSections,
  })

  const engineBullets = latest?.summary ? extractMarkdownBullets(latest.summary, 2) : []
  const analysisExcerpt =
    engineBullets.length > 0
      ? engineBullets.join("；")
      : latest?.summary
        ? stripMarkdown(latest.summary, 220)
        : undefined

  const llmInsight =
    llmSummary && llmSummary.length > 40 ? stripMarkdown(llmSummary, 320) : undefined

  const applied = applyVerdict(verdict, label, findings)

  return {
    ...applied,
    points: points.slice(0, 5),
    analysisExcerpt,
    llmInsight,
    conclusionReason: parsedSections?.reason,
    parsedSections,
    scores,
  }
}
