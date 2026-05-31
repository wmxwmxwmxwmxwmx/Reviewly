import type { PullRequestListItem, ReviewStatus } from "@reviewly/shared"

import type { PrioritySettings } from "@/features/prism/lib/governance-priority-settings"
import type { ReviewTaskStoreSnapshot } from "@/features/prism/lib/review-task-store"
import { isDeferred, isReturnedToInbox } from "@/features/prism/lib/review-task-store"
import {
  mapApiRiskToZh,
  type ReviewTask,
  type ReviewTaskQueue,
  type ReviewTaskSignals,
} from "@/features/prism/types/review-task"

const AUTH_PATTERN = /\b(auth|oauth|jwt|session|login|middleware)\b/i
const PAYMENT_PATTERN = /\b(payment|billing|stripe|webhook|checkout|invoice)\b/i
const CI_PATTERN = /\b(ci|build fail|check fail|pipeline fail|tests? fail)\b/i
const TESTS_MISSING_PATTERN = /缺少测试|无测试|test coverage|missing test|no test/i
const DOCS_PATTERN = /\b(docs?|readme|typo|format|chore\(deps\))\b/i

export type PrMetrics = {
  branch?: string
  filesChanged?: number
}

function combinedText(pr: PullRequestListItem): string {
  const summary = pr.aiSummary?.content ?? ""
  return `${pr.title} ${summary}`.toLowerCase()
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
  if (filesChanged > 0 && filesChanged > 5) mins += 1
  return Math.min(15, mins)
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

function calcScore(
  pr: PullRequestListItem,
  signals: ReviewTaskSignals,
  settings: PrioritySettings,
  store: ReviewTaskStoreSnapshot,
  realFilesChanged: number | undefined,
): number {
  const risk = mapApiRiskToZh(pr.riskLevel)
  const filesForComplexity = realFilesChanged ?? 0
  const complexity = estimateComplexity(pr, filesForComplexity)

  let score = settings.riskWeights[risk]
  if (signals.ciFailed) score += settings.ciFailed
  if (signals.auth || signals.payment) score += settings.authPayment
  if (signals.testsMissing) score += settings.testsMissing
  score += complexity * settings.complexityFactor
  if (realFilesChanged !== undefined && realFilesChanged > 0) {
    score += realFilesChanged * settings.filesFactor
  }
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
  metricsCache?: Map<string, PrMetrics>
}

/** Ranker: score + signals + queue only. AI recommendation enriched separately. */
export function computePriority(
  prs: PullRequestListItem[],
  options: ComputePriorityOptions,
): ReviewTask[] {
  const { settings, store, metricsCache } = options

  const tasks = prs
    .filter((pr) => !store.dismissed.includes(pr.id))
    .map((pr) => {
      const metrics = metricsCache?.get(pr.id)
      const realFiles = metrics?.filesChanged
      const hasRealFiles = realFiles !== undefined && realFiles > 0
      const filesChanged = hasRealFiles ? realFiles : 0
      const signals = enhanceSignals(pr, hasRealFiles ? filesChanged : 0)
      const riskLevel = mapApiRiskToZh(pr.riskLevel)
      const priorityScore = calcScore(pr, signals, settings, store, realFiles)
      const queue = assignQueue(pr, store)
      const complexity = estimateComplexity(pr, filesChanged)
      const branch = metrics?.branch ?? "—"

      return {
        prId: pr.id,
        title: pr.displayName?.trim() || pr.title,
        repo: pr.repo,
        branch,
        riskLevel,
        priorityScore,
        priorityReason: "",
        recommendedAction: "需要审查",
        queue,
        hasRealAi: false,
        aiSummary: pr.aiSummary?.content ?? "",
        filesChanged,
        hasRealFiles,
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
