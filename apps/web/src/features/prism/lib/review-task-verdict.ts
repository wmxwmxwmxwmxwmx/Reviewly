import type { AnalysisFinding, AnalysisSummary, PullRequestListItem } from "@reviewly/shared"

import {
  buildAiReviewerOpinion,
  isPrAnalysisComplete,
  type AiReviewerOpinion,
  type AiReviewerVerdict,
} from "@/lib/ai/ai-reviewer-opinion"
import type { ReviewTask, ReviewAdvisoryAction } from "@/features/prism/types/review-task"



export type TaskRecommendation = {
  action: ReviewAdvisoryAction | null
  reason: string | null
  hasRealAi: boolean
  opinion?: AiReviewerOpinion
}

export function verdictToAdvisoryAction(
  verdict: AiReviewerVerdict,
): ReviewAdvisoryAction {
  switch (verdict) {
    case "approve":
      return "风险较低"
    case "block":
      return "建议重点检查"
    case "request_changes":
      return "建议要求修改"
    default:
      return "立即 Review"
  }
}

/** @deprecated Use verdictToAdvisoryAction */
export function verdictToRecommendedAction(
  verdict: AiReviewerVerdict,
  _deferred: boolean,
): ReviewAdvisoryAction {
  return verdictToAdvisoryAction(verdict)
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
  const { pr, findings = [], latest, generatedSummary } = input

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



  const action = verdictToAdvisoryAction(opinion.verdict)

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
): ReviewTask[] {
  return tasks.map((task) => {
    const rec = resolveTaskRecommendation({
      pr: task.source,
    })

    const advisory = rec.action ?? "立即 Review"

    return {
      ...task,
      hasRealAi: rec.hasRealAi,
      advisoryAction: advisory,
      recommendedAction: advisory,
      priorityReason: rec.reason ?? "",
      opinion: rec.opinion,
    }
  })
}

