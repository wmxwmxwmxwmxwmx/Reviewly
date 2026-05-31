"use client"

import { Bot } from "lucide-react"
import type { AnalysisFinding, AnalysisSummary } from "@reviewly/shared"

import { buildAiReviewerOpinion } from "@/lib/ai/ai-reviewer-opinion"
import { cn } from "@/lib/utils"

interface ReviewQuickVerdictProps {
  findings: AnalysisFinding[]
  latest?: AnalysisSummary | null
  prTitle?: string
  repoLabel?: string
  prNumber?: number
  aiSummary?: string
  hasCompletedAnalysis?: boolean
  fallbackScores?: {
    riskScore?: number
    securityScore?: number
    performanceScore?: number
    maintainabilityScore?: number
  }
}

function scoreBar(label: string, value: number) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-8 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-surface-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-ai-blue/80"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-6 text-right font-mono text-muted-foreground">{value}</span>
    </div>
  )
}

export function ReviewQuickVerdict({
  findings,
  latest,
  prTitle,
  repoLabel,
  prNumber,
  aiSummary,
  hasCompletedAnalysis,
  fallbackScores: _fallbackScores,
}: ReviewQuickVerdictProps) {
  const opinion = buildAiReviewerOpinion({
    findings,
    latest,
    prTitle,
    repoLabel,
    prNumber,
    generatedSummary: aiSummary,
    hasCompletedAnalysis,
  })

  const excerpt =
    aiSummary?.trim().split(/\n/).find((l) => l.trim())?.slice(0, 160) ??
    latest?.summary?.split(/\n/).find((l) => l.trim())?.slice(0, 160)

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-ai-blue shrink-0" />
        <span className="text-xs font-semibold text-foreground">AI 评审建议</span>
        <span
          className={cn(
            "ml-auto text-[10px] px-2 py-0.5 rounded-full border font-medium",
            opinion.suggestChanges
              ? "bg-risk-high/15 text-risk-high border-risk-high/30"
              : opinion.verdict === "pending"
                ? "bg-surface-3 text-muted-foreground border-border"
                : "bg-risk-low/15 text-risk-low border-risk-low/30",
          )}
        >
          {opinion.verdictLabel}
        </span>
      </div>
      {excerpt ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{excerpt}</p>
      ) : opinion.points[0] ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {opinion.points[0]}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">完成分析后将显示一句话结论</p>
      )}
      <div className="space-y-1 pt-1 border-t border-border/60">
        {scoreBar("风险", opinion.scores.riskScore)}
        {scoreBar("安全", opinion.scores.securityScore)}
        {scoreBar("性能", opinion.scores.performanceScore)}
      </div>
    </div>
  )
}
