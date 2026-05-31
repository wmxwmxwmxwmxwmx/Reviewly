import type { PullRequestListItem } from "@reviewly/shared"

import type { PrioritySettings } from "@/features/prism/lib/governance-priority-settings"
import {
  computeAttentionState,
  getFingerprintInput,
  type ReviewAttentionState,
} from "@/features/prism/lib/review-attention-state"
import { isRepositoryManaged } from "@/lib/repos/is-repository-managed"
import {
  mapApiRiskToZh,
  isHighRiskLevel,
  type ReviewInboxItem,
  type ReviewTaskSignals,
  type InboxSegment,
} from "@/features/prism/types/review-task"

const AUTH_PATTERN = /\b(auth|oauth|jwt|session|login|middleware)\b/i
const PAYMENT_PATTERN = /\b(payment|billing|stripe|webhook|checkout|invoice)\b/i
const CI_PATTERN = /\b(ci|build fail|check fail|pipeline fail|tests? fail)\b/i
const TESTS_MISSING_PATTERN = /缺少测试|无测试|test coverage|missing test|no test/i
const DOCS_PATTERN = /\b(docs?|readme|typo|format|chore\(deps\))\b/i

const WEIGHTS = {
  risk: { 严重: 100, 高: 70, 中: 40, 低: 15 },
  newPr: 50,
  newCommit: 45,
  ciFailure: 35,
  aiIssue: 30,
  recentUpdate: 20,
  authPayment: 25,
} as const

export type PrMetrics = {
  branch?: string
  filesChanged?: number
}

function combinedText(pr: PullRequestListItem): string {
  const summary = pr.aiSummary?.content ?? ""
  return `${pr.title} ${summary}`.toLowerCase()
}

function enhanceSignals(pr: PullRequestListItem, filesChanged: number): ReviewTaskSignals {
  const text = combinedText(pr)
  const docsOnly = DOCS_PATTERN.test(pr.title) || DOCS_PATTERN.test(text)
  const smallChange =
    filesChanged > 0 &&
    filesChanged <= 2 &&
    (pr.riskLevel === "low" || pr.riskLevel === "medium")
  return {
    auth: AUTH_PATTERN.test(text),
    payment: PAYMENT_PATTERN.test(text),
    testsMissing: TESTS_MISSING_PATTERN.test(text),
    ciFailed: CI_PATTERN.test(text),
    hotFiles: pr.riskLevel === "critical" || pr.riskLevel === "high" || (pr.riskScore ?? 0) >= 70,
    docsOnly,
    smallChange,
  }
}

function recentUpdateWeight(updatedAt: string): number {
  const ageMs = Date.now() - new Date(updatedAt).getTime()
  const hours = ageMs / (1000 * 60 * 60)
  if (hours <= 6) return WEIGHTS.recentUpdate
  if (hours <= 24) return Math.round(WEIGHTS.recentUpdate * 0.6)
  if (hours <= 72) return Math.round(WEIGHTS.recentUpdate * 0.3)
  return 0
}

function buildAttentionReasons(
  pr: PullRequestListItem,
  signals: ReviewTaskSignals,
  attentionState: ReviewAttentionState,
): string[] {
  const reasons: string[] = []
  if (attentionState === "unread") reasons.push("新 PR")
  if (attentionState === "needs_revisit") reasons.push("PR 有更新")
  if (signals.payment) reasons.push("涉及支付模块")
  if (signals.auth) reasons.push("涉及 auth 模块")
  if (signals.ciFailed) reasons.push("CI 失败")
  if (signals.testsMissing) reasons.push("测试缺失")
  if (signals.hotFiles) reasons.push("热点文件")
  if (reasons.length === 0 && isHighRiskLevel(mapApiRiskToZh(pr.riskLevel))) {
    reasons.push("高风险变更")
  }
  if (reasons.length === 0) reasons.push("建议查看")
  return reasons
}

function calcAttentionScore(
  pr: PullRequestListItem,
  signals: ReviewTaskSignals,
  attentionState: ReviewAttentionState,
): number {
  const risk = mapApiRiskToZh(pr.riskLevel)
  let score = WEIGHTS.risk[risk]
  if (attentionState === "unread") score += WEIGHTS.newPr
  if (attentionState === "needs_revisit") score += WEIGHTS.newCommit
  if (signals.ciFailed) score += WEIGHTS.ciFailure
  if (signals.auth || signals.payment) score += WEIGHTS.authPayment
  if (signals.testsMissing || signals.hotFiles) score += WEIGHTS.aiIssue
  score += recentUpdateWeight(pr.updatedAt)
  return Math.max(0, Math.round(score))
}

function sortInboxItems(a: ReviewInboxItem, b: ReviewInboxItem): number {
  const stateOrder: Record<ReviewAttentionState, number> = {
    unread: 0,
    needs_revisit: 1,
    reviewed: 2,
  }
  const sa = stateOrder[a.attentionState]
  const sb = stateOrder[b.attentionState]
  if (sa !== sb) return sa - sb

  const riskOrder: Record<ReviewInboxItem["riskLevel"], number> = {
    严重: 0,
    高: 1,
    中: 2,
    低: 3,
  }
  const ra = riskOrder[a.riskLevel]
  const rb = riskOrder[b.riskLevel]
  if (ra !== rb) return ra - rb

  const timeA = new Date(a.updatedAt).getTime()
  const timeB = new Date(b.updatedAt).getTime()
  if (timeA !== timeB) return timeB - timeA

  return b.attentionScore - a.attentionScore
}

export type ComputeInboxOptions = {
  settings?: PrioritySettings
  metricsCache?: Map<string, PrMetrics>
}

export function computeInboxItems(
  prs: PullRequestListItem[],
  options: ComputeInboxOptions = {},
): ReviewInboxItem[] {
  void options.settings
  const { metricsCache } = options

  const items = prs
    .filter(isRepositoryManaged)
    .map((pr) => {
      const fingerprint = getFingerprintInput(pr)
      const attentionState = computeAttentionState(pr.id, fingerprint)
      const metrics = metricsCache?.get(pr.id)
      const realFiles = metrics?.filesChanged
      const hasRealFiles = realFiles !== undefined && realFiles > 0
      const filesChanged = hasRealFiles ? realFiles : 0
      const signals = enhanceSignals(pr, hasRealFiles ? filesChanged : 0)
      const riskLevel = mapApiRiskToZh(pr.riskLevel)
      const attentionScore = calcAttentionScore(pr, signals, attentionState)
      const attentionReasons = buildAttentionReasons(pr, signals, attentionState)
      const branch = metrics?.branch ?? "—"

      return {
        prId: pr.id,
        title: pr.displayName?.trim() || pr.title,
        repo: pr.repo,
        branch,
        author: pr.author,
        updatedAt: pr.updatedAt,
        riskLevel,
        attentionState,
        attentionScore,
        attentionReasons,
        advisoryAction: "立即 Review" as const,
        priorityReason: "",
        priorityScore: attentionScore,
        recommendedAction: "立即 Review" as const,
        queue: "inbox" as const,
        hasRealAi: false,
        aiSummary: pr.aiSummary?.content ?? "",
        filesChanged,
        hasRealFiles,
        complexity: Math.min(100, Math.round((pr.riskScore ?? 30) * 0.6 + filesChanged * 4)),
        estimatedMinutes: 5,
        signals,
        source: pr,
      } satisfies ReviewInboxItem
    })

  return items.sort(sortInboxItems)
}

export function filterInboxItems(
  items: ReviewInboxItem[],
  segment: InboxSegment,
): ReviewInboxItem[] {
  switch (segment) {
    case "unread":
      return items.filter((i) => i.attentionState === "unread")
    case "read":
      return items.filter(
        (i) => i.attentionState === "reviewed" || i.attentionState === "needs_revisit",
      )
    case "all":
    default:
      return items
  }
}

/** @deprecated Use computeInboxItems */
export function computePriority(
  prs: PullRequestListItem[],
  options: ComputeInboxOptions & { store?: unknown } = {},
): ReviewInboxItem[] {
  return computeInboxItems(prs, options)
}

export type { ReviewInboxItem }
