"use client"

import { useEffect, useState } from "react"
import type { ReviewCenterStats } from "@reviewly/shared"
import { Loader2 } from "lucide-react"
import { fetchReviewStats } from "@/lib/api/review-center"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { useAISettings } from "@/features/prism/contexts/ai-settings-context"

export function ReviewCenterStatsView() {
  const [data, setData] = useState<ReviewCenterStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { monthlyUsage } = useAISettings()

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    void fetchReviewStats(ac.signal)
      .then((result) => {
        if (!shouldApplyResult(ac.signal)) return
        setData(result)
        setError(null)
      })
      .catch((e) => {
        if (isAbortError(e) || !shouldApplyResult(ac.signal)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      })
      .finally(() => {
        if (shouldApplyResult(ac.signal)) setLoading(false)
      })
    return () => ac.abort()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载统计数据…
      </div>
    )
  }

  if (error || !data) {
    return <p className="py-12 text-center text-sm text-risk-high">{error ?? "暂无数据"}</p>
  }

  const maxTrend = Math.max(1, ...data.dailyTrend.map((d) => d.analysisCount))

  return (
    <div className="p-5 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">数据统计</h2>
        <p className="text-[12px] text-muted-foreground mt-1">评审效率与 AI 用量分析</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "本周分析次数", value: data.weeklyAnalysisCount },
          { label: "AI 调用次数", value: data.aiCalls },
          { label: "Token 消耗", value: data.totalTokens.toLocaleString() },
          { label: "AI 成本 (CNY)", value: `¥${(data.costCny + monthlyUsage.costCny).toFixed(2)}` },
          { label: "通过率", value: `${(data.approvalRate * 100).toFixed(1)}%` },
          { label: "驳回率", value: `${(data.rejectionRate * 100).toFixed(1)}%` },
          { label: "高风险 PR", value: data.highRiskCount },
          { label: "本月调用", value: monthlyUsage.calls },
        ].map((item) => (
          <div
            key={item.label}
            className="p-4 rounded-lg border border-border bg-card"
          >
            <div className="text-[10px] text-muted-foreground mb-1">{item.label}</div>
            <div className="text-xl font-semibold font-mono">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-4">近 7 日分析趋势</h3>
        <div className="flex items-end gap-2 h-32">
          {data.dailyTrend.map((point) => (
            <div key={point.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className="w-full rounded-t bg-ai-blue/80 min-h-[4px] transition-all"
                style={{ height: `${(point.analysisCount / maxTrend) * 100}%` }}
                title={`${point.analysisCount} 次`}
              />
              <span className="text-[9px] text-muted-foreground font-mono truncate w-full text-center">
                {point.date.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
