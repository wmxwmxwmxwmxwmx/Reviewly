import type { PullRequestListItem, ReviewStatus } from "@reviewly/shared"

import type { PrioritySettings } from "@/features/prism/lib/governance-priority-settings"
import type { ReviewTaskStoreSnapshot } from "@/features/prism/lib/review-task-store"
import {
  isDeferred,
  isReturnedToInbox,
} from "@/features/prism/lib/review-task-store"
import {
  mapApiRiskToZh,
  type ReviewTask,
  type ReviewTaskAction,
  type ReviewTaskQueue,
  type ReviewTaskSignals,
} from "@/features/prism/types/review-task"

const AUTH_PATTERN = /\b(auth|oauth|jwt|session|login|middleware)\b/i
const PAYMENT_PATTERN = /\b(payment|billing|stripe|webhook|checkout|invoice)\b/i
const CI_PATTERN = /\b(ci|build fail|check fail|pipeline fail|tests? fail)\b/i
const TESTS_MISSING_PATTERN = /缺少测试|无测试|test coverage|missing test|no test/i
const DOCS_PATTERN = /\b(docs?|readme|typo|format|chore\(deps\))\b/i

function combinedText(pr: PullRequestListItem): string {
  const summary = pr.aiSummary?.content ?? ""
  return `${pr.title} ${summary}`.toLowerCase()
}

function estimateFilesChanged(pr: PullRequestListItem): number {
  const score = pr.riskScore ?? 0
  if (score >= 80) return 10
  if (score >= 60) return 7
  if (score >= 40) return 4
  if (score >= 20) return 2
  return 1
}

function estimateComplexity(pr: PullRequestListItem, filesChanged: number): number {
  const base = pr.riskScore ?? 30
  return Math.min(100, Math.round(base * 0.6 + filesChanged * 4))
}

function estimateMinutes(
  risk: ReviewTask["riskLevel"],
  signals: ReviewTaskSignals,
  filesChanged: number,
): number {
  let mins = 2
  if (risk === "严重") mins = 8
  else if (risk === "高") mins = 5
  else if (risk === "中") mins = 3
  if (signals.auth || signals.payment) mins += 2
  if (signals.ciFailed) mins += 2
  if (filesChanged > 5) mins += 1
  return Math.min(15, mins)
}

function enhanceSignals(pr: PullRequestListItem, filesChanged: number): ReviewTaskSignals {
  const text = combinedText(pr)
  const docsOnly = DOCS_PATTERN.test(pr.title) || DOCS_PATTERN.test(text)
  const smallChange =
    filesChanged <= 2 && (pr.riskLevel === "low" || pr.riskLevel === "medium")
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

function buildPriorityReason(signals: ReviewTaskSignals, risk: ReviewTask["riskLevel"]): string {
  const parts: string[] = []
  if (signals.payment) parts.push("支付")
  if (signals.auth) parts.push("auth")
  if (signals.ciFailed) parts.push("CI失败")
  if (signals.testsMissing) parts.push("测试缺失")
  if (signals.hotFiles && risk !== "低") parts.push("热点文件")
  if (signals.docsOnly) parts.push("文档类")
  if (signals.smallChange) parts.push("小改动")
  if (parts.length === 0) {
    if (risk === "严重" || risk === "高") return `高风险（${risk}）`
    return "常规评审"
  }
  return parts.join(" + ")
}

function calcScore(
  pr: PullRequestListItem,
  signals: ReviewTaskSignals,
  settings: PrioritySettings,
  store: ReviewTaskStoreSnapshot,
): number {
  const risk = mapApiRiskToZh(pr.riskLevel)
  const filesChanged = estimateFilesChanged(pr)
  const complexity = estimateComplexity(pr, filesChanged)

  let score = settings.riskWeights[risk]
  if (signals.ciFailed) score += settings.ciFailed
  if (signals.auth || signals.payment) score += settings.authPayment
  if (signals.testsMissing) score += settings.testsMissing
  score += complexity * settings.complexityFactor
  score += filesChanged * settings.filesFactor
  if (signals.docsOnly) score -= settings.docsOnlyPenalty
  if (signals.smallChange) score -= settings.smallChangePenalty
  if (isDeferred(store, pr.id)) score *= settings.deferredMultiplier
  return Math.max(0, Math.round(score))
}

function assignQueue(
  pr: PullRequestListItem,
  store: ReviewTaskStoreSnapshot,
): ReviewTaskQueue {
  if (isReturnedToInbox(store, pr.id)) return "inbox"
  const status: ReviewStatus = pr.reviewStatus ?? "OPEN"
  if (status === "IN_REVIEW") return "processing"
  if (status === "APPROVED" || status === "MERGED" || status === "CLOSED") return "done"
  return "inbox"
}

function addRecommendation(
  pr: PullRequestListItem,
  signals: ReviewTaskSignals,
  risk: ReviewTask["riskLevel"],
  store: ReviewTaskStoreSnapshot,
): ReviewTaskAction {
  if (isDeferred(store, pr.id)) return "延后"
  if (pr.reviewStatus === "CHANGES_REQUESTED") return "要求修改"
  if (
    (risk === "严重" || risk === "高") &&
    (signals.auth || signals.payment || signals.ciFailed)
  ) {
    return "需要审查"
  }
  if (risk === "低" && !signals.auth && !signals.payment && !signals.ciFailed) {
    return "通过"
  }
  if (signals.ciFailed || signals.hotFiles) return "需要审查"
  return "需要审查"
}

function matchesIgnoredPattern(title: string, patterns: string[]): boolean {
  const lower = title.toLowerCase()
  return patterns.some((p) => lower.includes(p.toLowerCase()))
}

function sortTasks(a: ReviewTask, b: ReviewTask, store: ReviewTaskStoreSnapshot): number {
  const aDef = isDeferred(store, a.prId) ? 1 : 0
  const bDef = isDeferred(store, b.prId) ? 1 : 0
  if (aDef !== bDef) return aDef - bDef
  return b.priorityScore - a.priorityScore
}

export type ComputePriorityOptions = {
  settings: PrioritySettings
  store: ReviewTaskStoreSnapshot
  branchCache?: Map<string, string>
}

export function computePriority(
  prs: PullRequestListItem[],
  options: ComputePriorityOptions,
): ReviewTask[] {
  const { settings, store, branchCache } = options

  const tasks = prs
    .filter((pr) => !store.dismissed.includes(pr.id))
    .map((pr) => {
      const filesChanged = estimateFilesChanged(pr)
      const signals = enhanceSignals(pr, filesChanged)
      const riskLevel = mapApiRiskToZh(pr.riskLevel)
      const priorityScore = calcScore(pr, signals, settings, store)
      const priorityReason = buildPriorityReason(signals, riskLevel)
      const recommendedAction = addRecommendation(pr, signals, riskLevel, store)
      const queue = assignQueue(pr, store)
      const complexity = estimateComplexity(pr, filesChanged)
      const branch = branchCache?.get(pr.id) ?? "—"

      return {
        prId: pr.id,
        title: pr.displayName?.trim() || pr.title,
        repo: pr.repo,
        branch,
        riskLevel,
        priorityScore,
        priorityReason,
        recommendedAction,
        queue,
        aiSummary: pr.aiSummary?.content ?? "",
        filesChanged,
        complexity,
        estimatedMinutes: estimateMinutes(riskLevel, signals, filesChanged),
        signals,
        source: pr,
      } satisfies ReviewTask
    })

  return tasks.sort((a, b) => sortTasks(a, b, store))
}

export function filterTasksByQueue(tasks: ReviewTask[], queue: ReviewTaskQueue): ReviewTask[] {
  return tasks.filter((t) => t.queue === queue)
}

export function shouldShowInInbox(task: ReviewTask, store: ReviewTaskStoreSnapshot): boolean {
  if (task.queue !== "inbox") return false
  if (matchesIgnoredPattern(task.title, store.ignoredPatterns)) return false
  return true
}

export function getNextInboxTask(
  tasks: ReviewTask[],
  currentPrId: string | null,
  store: ReviewTaskStoreSnapshot,
): ReviewTask | null {
  const inbox = filterTasksByQueue(tasks, "inbox").filter((t) =>
    shouldShowInInbox(t, store),
  )
  if (inbox.length === 0) return null
  if (!currentPrId) return inbox[0] ?? null
  const idx = inbox.findIndex((t) => t.prId === currentPrId)
  if (idx >= 0 && idx + 1 < inbox.length) return inbox[idx + 1] ?? null
  if (idx >= 0) return null
  return inbox[0] ?? null
}
