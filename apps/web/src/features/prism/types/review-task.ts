import type { PullRequestListItem } from "@reviewly/shared"

import type { AiReviewerOpinion } from "@/lib/ai/ai-reviewer-opinion"
import type { ReviewAttentionState } from "@/features/prism/lib/review-attention-state"

export type ReviewTaskRisk = "低" | "中" | "高" | "严重"
export type ReviewAdvisoryAction =
  | "立即 Review"
  | "建议重点检查"
  | "风险较低"

/** @deprecated Use ReviewInboxItem + attentionState */
export type ReviewTaskQueue = "inbox" | "processing" | "done"

export type ReviewTaskSignals = {
  auth: boolean
  payment: boolean
  testsMissing: boolean
  ciFailed: boolean
  hotFiles: boolean
  docsOnly: boolean
  smallChange: boolean
}

export type ReviewInboxItem = {
  prId: string
  title: string
  repo: string
  branch: string
  author: string
  updatedAt: string

  riskLevel: ReviewTaskRisk
  attentionState: ReviewAttentionState
  attentionScore: number
  attentionReasons: string[]

  advisoryAction: ReviewAdvisoryAction
  priorityReason: string

  /** @deprecated legacy field */
  priorityScore: number
  /** @deprecated legacy field */
  recommendedAction: ReviewAdvisoryAction
  /** @deprecated legacy field */
  queue: ReviewTaskQueue

  hasRealAi: boolean
  opinion?: AiReviewerOpinion
  aiSummary: string

  filesChanged: number
  hasRealFiles: boolean
  complexity: number
  estimatedMinutes: number

  signals: ReviewTaskSignals
  source: PullRequestListItem
}

/** @deprecated Use ReviewInboxItem */
export type ReviewTask = ReviewInboxItem

export type InboxSegment = "unread" | "read" | "all"

export function mapApiRiskToZh(
  level: PullRequestListItem["riskLevel"],
): ReviewTaskRisk {
  switch (level) {
    case "critical":
      return "严重"
    case "high":
      return "高"
    case "medium":
      return "中"
    default:
      return "低"
  }
}

export function isHighRiskLevel(risk: ReviewTaskRisk): boolean {
  return risk === "严重" || risk === "高"
}

export function githubStateLabel(state: PullRequestListItem["state"]): string {
  switch (state) {
    case "merged":
      return "Merged"
    case "closed":
      return "Closed"
    default:
      return "Open"
  }
}
