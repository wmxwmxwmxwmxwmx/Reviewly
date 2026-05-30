"use client"

import { Bot, Shield, Gauge, Layers, AlertTriangle } from "lucide-react"
import type { AnalysisSummary } from "@reviewly/shared"
import { cn } from "@/lib/utils"

interface AiReviewerCardProps {
  securityScore?: number
  performanceScore?: number
  maintainabilityScore?: number
  riskScore?: number
  mergeRecommendation?: AnalysisSummary["mergeRecommendation"]
  criticalCount?: number
  aiSummary?: string
}

function scoreColor(score: number) {
  if (score >= 80) return "text-risk-low"
  if (score >= 60) return "text-amber-300"
  return "text-risk-high"
}

export function AiReviewerCard({
  securityScore = 0,
  performanceScore = 0,
  maintainabilityScore = 0,
  riskScore = 0,
  mergeRecommendation,
  criticalCount = 0,
  aiSummary,
}: AiReviewerCardProps) {
  const suggestChanges =
    criticalCount > 0 ||
    securityScore < 60 ||
    mergeRecommendation === "block" ||
    mergeRecommendation === "request_changes"

  const aiVerdict = suggestChanges ? "需要修改" : mergeRecommendation === "approve" ? "建议合并" : "待人工确认"

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-ai-purple/5">
        <Bot className="w-4 h-4 text-ai-purple" />
        <span className="text-sm font-semibold text-foreground">AI Reviewer</span>
        <span
          className={cn(
            "ml-auto text-[10px] px-2 py-0.5 rounded-full border font-medium",
            suggestChanges
              ? "bg-risk-high/15 text-risk-high border-risk-high/30"
              : "bg-risk-low/15 text-risk-low border-risk-low/30",
          )}
        >
          AI 建议：{aiVerdict}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
        {[
          { label: "风险评分", value: riskScore, icon: AlertTriangle },
          { label: "安全评分", value: securityScore, icon: Shield },
          { label: "性能评分", value: performanceScore, icon: Gauge },
          { label: "架构评分", value: maintainabilityScore, icon: Layers },
        ].map((item) => (
          <div key={item.label} className="bg-card px-3 py-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <item.icon className="w-3 h-3" />
              {item.label}
            </div>
            <div className={cn("text-lg font-semibold font-mono", scoreColor(item.value))}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {aiSummary ? (
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground mb-1">AI 结论摘要</p>
          <p className="text-[11px] text-foreground line-clamp-3">{aiSummary.replace(/[#*`]/g, "").slice(0, 200)}</p>
        </div>
      ) : null}
    </div>
  )
}
