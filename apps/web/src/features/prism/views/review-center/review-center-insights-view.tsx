"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import type { ReviewCenterStats } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { useGovernance } from "@/hooks/use-governance"
import { fetchReviewStats } from "@/lib/api/review-center"
import { PrismApiError } from "@/lib/api/client"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { cn } from "@/lib/utils"

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-mono font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface-2/30 p-3", className)}>
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function ReviewCenterInsightsView() {
  const { navigate } = useNavigation()
  const { monthlyUsage } = useAISettings()
  const { rules, loading: rulesLoading } = useGovernance({ includeDisabled: true })
  const [data, setData] = useState<ReviewCenterStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    void fetchReviewStats(ac.signal)
      .then((result) => {
        if (!shouldApplyResult(ac.signal)) return
        setData(result)
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

  const enabledRules = rules.filter((r) => r.enabled !== false)
  const totalCost = (data?.costCny ?? 0) + monthlyUsage.costCny
  const maxTrend = Math.max(1, ...(data?.dailyTrend.map((d) => d.analysisCount) ?? [1]))
  const trendEmpty = data?.dailyTrend.every((d) => d.analysisCount === 0) ?? true

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载 Insights…
      </div>
    )
  }

  if (error || !data) {
    return <p className="py-12 text-center text-sm text-risk-high px-4">{error ?? "暂无数据"}</p>
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Insights</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">评审效率、AI 用量与治理概览</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="AI Performance">
          <StatLine label="本周分析次数" value={data.weeklyAnalysisCount} />
          <StatLine label="AI 调用" value={data.aiCalls} />
          <StatLine
            label="Token 消耗"
            value={data.totalTokens.toLocaleString()}
          />
          <StatLine label="AI 成本 (CNY)" value={`¥${totalCost.toFixed(2)}`} />
          <StatLine
            label="平均审批耗时"
            value={`${data.avgApprovalHours.toFixed(1)}h`}
          />
        </Section>

        <Section title="Review Health">
          <StatLine label="通过率" value={`${(data.approvalRate * 100).toFixed(1)}%`} />
          <StatLine label="驳回率" value={`${(data.rejectionRate * 100).toFixed(1)}%`} />
          <StatLine label="高风险 PR" value={data.highRiskCount} />
          <StatLine label="本月 AI 调用" value={monthlyUsage.calls} />
        </Section>
      </div>

      <Section title="7-day trend">
        {trendEmpty ? (
          <p className="text-[11px] text-muted-foreground py-4 text-center">本周暂无分析记录</p>
        ) : (
          <div className="flex items-end gap-1.5 h-32">
            {data.dailyTrend.map((point) => (
              <div
                key={point.date}
                className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end"
              >
                <span className="text-[9px] font-mono text-muted-foreground">
                  {point.analysisCount > 0 ? point.analysisCount : ""}
                </span>
                <div
                  className="w-full rounded-t bg-ai-blue/70 min-h-[4px]"
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
      </Section>

      <Section title="Governance">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {rulesLoading ? "—" : `${enabledRules.length}`}
              <span className="text-muted-foreground font-normal text-[11px] ml-1.5">
                条启用 / 共 {rules.length} 条规则
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              在工程治理中心配置门禁与合规策略
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs shrink-0"
            onClick={() => navigate("governance")}
          >
            打开治理中心
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </Section>
    </div>
  )
}
