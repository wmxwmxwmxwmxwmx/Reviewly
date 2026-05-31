import type { PullRequestListItem } from "@reviewly/shared"

import type { AiReviewerOpinion } from "@/lib/ai/ai-reviewer-opinion"

export type ReviewTaskRisk = "低" | "中" | "高" | "严重"
export type ReviewTaskAction = "通过" | "需要审查" | "要求修改" | "延后"
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

export type ReviewTask = {
  prId: string
  title: string
  repo: string
  branch: string

  riskLevel: ReviewTaskRisk
  priorityScore: number
  priorityReason: string

  recommendedAction: ReviewTaskAction
  queue: ReviewTaskQueue

  /** True when recommendation comes from buildAiReviewerOpinion */
  hasRealAi: boolean

  opinion?: AiReviewerOpinion

  aiSummary: string

  /** 0 = unknown; only show in UI when hasRealFiles */
  filesChanged: number
  hasRealFiles: boolean
  complexity: number
  estimatedMinutes: number

  signals: ReviewTaskSignals

  source: PullRequestListItem
}

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
