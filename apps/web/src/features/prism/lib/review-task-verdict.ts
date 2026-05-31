import type { AnalysisFinding, AnalysisSummary, PullRequestListItem } from "@reviewly/shared"

import { isDeferred, type ReviewTaskStoreSnapshot } from "@/features/prism/lib/review-task-store"
import {
  buildAiReviewerOpinion,
  isPrAnalysisComplete,
  type AiReviewerOpinion,
  type AiReviewerVerdict,
} from "@/lib/ai/ai-reviewer-opinion"
import type { ReviewTask, ReviewTaskAction } from "@/features/prism/types/review-task"

export type TaskRecommendation = {
  action: ReviewTaskAction | null
  reason: string | null
  hasRealAi: boolean
  opinion?: AiReviewerOpinion
}

export function verdictToRecommendedAction(
  verdict: AiReviewerVerdict,
  deferred: boolean,
): ReviewTaskAction | null {
  if (deferred) return "延后"
  switch (verdict) {
    case "approve":
      return "通过"
    case "block":
      return "需要审查"
    case "request_changes":
      return "要求修改"
    default:
      return null
  }
}

function extractReasonFromOpinion(opinion: AiReviewerOpinion): string | null {
  if (opinion.points.length > 0) {
    return opinion.points.slice(0, 3).join("；")
  }
  if (opinion.analysisExcerpt?.trim()) {
    return opinion.analysisExcerpt
  }
  if (opinion.llmInsight?.trim()) {
    return opinion.llmInsight.slice(0, 200)
  }
  return opinion.verdictLabel !== "待完成分析" ? opinion.verdictLabel : null
}

export function hasRealAiInput(input: {
  pr: PullRequestListItem
  findings?: AnalysisFinding[]
  latest?: AnalysisSummary | null
  generatedSummary?: string
}): boolean {
  const { pr, findings = [], latest, generatedSummary } = input
  const summary = generatedSummary ?? pr.aiSummary?.content
  return isPrAnalysisComplete({
    findings,
    generatedSummary: summary,
    latest,
  })
}

export function resolveTaskRecommendation(input: {
  pr: PullRequestListItem
  findings?: AnalysisFinding[]
  latest?: AnalysisSummary | null
  generatedSummary?: string
  deferred?: boolean
}): TaskRecommendation {
  const { pr, findings = [], latest, generatedSummary, deferred = false } = input
  const llmSummary = generatedSummary ?? pr.aiSummary?.content

  if (!hasRealAiInput({ pr, findings, latest, generatedSummary: llmSummary })) {
    return { action: null, reason: null, hasRealAi: false }
  }

  const opinion = buildAiReviewerOpinion({
    findings,
    latest: latest ?? null,
    prTitle: pr.displayName?.trim() || pr.title,
    repoLabel: pr.repo,
    prNumber: pr.number,
    generatedSummary: llmSummary,
    hasCompletedAnalysis: true,
  })

  const action = verdictToRecommendedAction(opinion.verdict, deferred)
  const reason = extractReasonFromOpinion(opinion)

  return {
    action,
    reason,
    hasRealAi: true,
    opinion,
  }
}

export function enrichTasksWithOpinion(
  tasks: ReviewTask[],
  store: ReviewTaskStoreSnapshot,
): ReviewTask[] {
  return tasks.map((task) => {
    const deferred = isDeferred(store, task.prId)
    const rec = resolveTaskRecommendation({
      pr: task.source,
      deferred,
    })

    return {
      ...task,
      hasRealAi: rec.hasRealAi,
      recommendedAction: rec.action ?? "需要审查",
      priorityReason: rec.reason ?? "",
      opinion: rec.opinion,
    }
  })
}
