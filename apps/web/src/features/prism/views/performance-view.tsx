"use client"

import { motion } from "framer-motion"
import { Gauge, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePerformance } from "@/hooks/use-performance"

export function PerformanceView() {
  const { stats, findings, loading, error } = usePerformance()

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">性能分析</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats
              ? `开放发现 ${stats.openFindings} · 影响 ${stats.avgImpact}`
              : "应用性能监控与优化建议"}
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors">
          <Gauge className="w-3.5 h-3.5" />
          运行性能测试
        </button>
      </div>

      {error && <p className="text-sm text-risk-high">{error}</p>}

      {!loading && findings.length === 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <Zap className="w-4 h-4 text-risk-medium" />
            <span className="text-sm font-medium text-foreground">API 性能发现</span>
          </div>
          <div className="p-4 text-sm text-muted-foreground">暂无性能发现。</div>
        </div>
      )}

      {!loading && findings.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <Zap className="w-4 h-4 text-risk-medium" />
            <span className="text-sm font-medium text-foreground">API 性能发现</span>
            <span className="text-xs text-muted-foreground ml-auto">{findings.length} 条</span>
          </div>
          <div className="divide-y divide-border">
            {findings.map((f) => (
              <div key={f.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground truncate">{f.title}</div>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", f.severity === "critical" || f.severity === "high" ? "bg-[oklch(0.62_0.21_32/0.1)] text-risk-high" : f.severity === "medium" ? "bg-[oklch(0.75_0.15_85/0.1)] text-risk-medium" : "bg-surface-3 text-muted-foreground")}>
                    {f.severity}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {f.file}:{f.line}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-surface-2 border border-border"
        >
          <div className="text-xs text-muted-foreground">开放发现</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-semibold text-foreground">{stats?.openFindings ?? 0}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-lg bg-surface-2 border border-border"
        >
          <div className="text-xs text-muted-foreground">平均影响</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={cn(
                "text-2xl font-semibold",
                stats?.avgImpact === "high"
                  ? "text-risk-high"
                  : stats?.avgImpact === "medium"
                    ? "text-risk-medium"
                    : "text-risk-low",
              )}
            >
              {stats?.avgImpact ?? "low"}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-lg bg-surface-2 border border-border"
        >
          <div className="text-xs text-muted-foreground">状态</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-semibold text-foreground">{stats?.status ?? "—"}</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
