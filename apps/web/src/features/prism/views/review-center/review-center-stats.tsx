"use client"

import { useEffect, useState } from "react"
import type { ReviewCenterStats } from "@reviewly/shared"
import { Loader2 } from "lucide-react"

import { fetchReviewStats } from "@/lib/api/review-center"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { cn } from "@/lib/utils"

function StatTile({
  label,
  value,
  primary,
}: {
  label: string
  value: string | number
  primary?: boolean
}) {
  return (
    <div className="px-3 py-2.5 rounded-md border border-border bg-surface-2/40">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div
        className={cn(
          "font-semibold font-mono text-foreground",
          primary ? "text-xl" : "text-base",
        )}
      >
        {value}
      </div>
    </div>
  )
}

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
    return <p className="py-12 text-center text-sm text-risk-high">{error ?? "暂无评审记录"}</p>
  }

  const maxTrend = Math.max(1, ...data.dailyTrend.map((d) => d.analysisCount))
  const trendEmpty = data.dailyTrend.every((d) => d.analysisCount === 0)
  const totalCost = data.costCny + monthlyUsage.costCny

  return (
    <div className="p-4 sm:p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">质量分析</h2>
        <p className="text-[12px] text-muted-foreground mt-1">查看团队代码质量趋势与风险分布</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          评审效率
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <StatTile
            label="通过率"
            value={`${(data.approvalRate * 100).toFixed(1)}%`}
            primary
          />
          <StatTile
            label="驳回率"
            value={`${(data.rejectionRate * 100).toFixed(1)}%`}
          />
          <StatTile label="高风险 PR" value={data.highRiskCount} />
          <StatTile label="本月活跃 PR" value={monthlyUsage.calls} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          AI 用量
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <StatTile label="评审次数" value={data.weeklyAnalysisCount} />
          <StatTile label="AI 分析次数" value={data.aiCalls} />
          <StatTile label="Token 用量" value={data.totalTokens.toLocaleString()} />
          <StatTile label="AI 成本 (CNY)" value={`¥${totalCost.toFixed(2)}`} primary />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-3">
        <h3 className="text-xs font-semibold text-foreground mb-3">近 7 日评审趋势</h3>
        {trendEmpty ? (
          <p className="text-[11px] text-muted-foreground py-8 text-center">
            本周暂无分析记录
          </p>
        ) : (
          <div className="flex items-end gap-1.5 h-40">
            {data.dailyTrend.map((point) => (
              <div
                key={point.date}
                className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end"
              >
                <span className="text-[9px] font-mono text-muted-foreground">
                  {point.analysisCount > 0 ? point.analysisCount : ""}
                </span>
                <div
                  className="w-full rounded-t bg-ai-blue/70 min-h-[4px] transition-all"
                  style={{ height: `${Math.max(4, (point.analysisCount / maxTrend) * 100)}%` }}
                  title={`${point.date}: ${point.analysisCount} 次`}
                />
                <span className="text-[9px] text-muted-foreground font-mono truncate w-full text-center">
                  {point.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
