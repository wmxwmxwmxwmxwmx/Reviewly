"use client"

import { Activity, AlertTriangle, GitBranch, Layers, Network } from "lucide-react"

import type { ArchitectureGraph, ArchitectureScanMetrics } from "@reviewly/shared"

import {
  computeArchitectureHealthScore,
  extendSummary,
  formatScannedAt,
  healthScoreTone,
  type ArchitectureSummaryExt,
} from "@/lib/architecture/graph-utils"
import { cn } from "@/lib/utils"

interface ArchitectureOverviewProps {
  graph: ArchitectureGraph | null
  metrics: ArchitectureScanMetrics | undefined
  loading?: boolean
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Activity
  tone?: "default" | "risk" | "good"
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 min-w-[120px] flex-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3 h-3 shrink-0" />
        {label}
      </div>
      <div
        className={cn(
          "text-lg font-semibold mt-1 tabular-nums",
          tone === "risk" && "text-risk-high",
          tone === "good" && "text-ai-blue",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export function ArchitectureOverview({ graph, metrics, loading }: ArchitectureOverviewProps) {
  const summary = extendSummary(metrics) as ArchitectureSummaryExt | undefined
  const health = computeArchitectureHealthScore(metrics, summary)
  const tone = healthScoreTone(health)
  const cycles = metrics?.cycles.length ?? 0
  const giants = metrics?.giantModules.length ?? 0
  const layers = metrics?.layerViolations.length ?? 0

  if (loading && !graph) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-surface-2 border border-border" />
        ))}
      </div>
    )
  }

  if (!graph?.nodes.length) return null

  const density =
    summary && summary.fileCount > 0
      ? (summary.edgeCount / summary.fileCount).toFixed(1)
      : "—"

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <MetricCard
          label="架构健康度"
          value={loading ? "…" : `${health}`}
          sub="/ 100"
          icon={Activity}
          tone={tone === "good" ? "good" : tone === "warn" ? "default" : "risk"}
        />
        <MetricCard
          label="源文件"
          value={String(summary?.fileCount ?? graph.nodes.length)}
          sub={summary?.truncated ? "采样扫描" : undefined}
          icon={Network}
        />
        <MetricCard
          label="依赖边"
          value={String(summary?.edgeCount ?? graph.edges.length)}
          sub={`密度 ${density}`}
          icon={GitBranch}
        />
        <MetricCard
          label="循环依赖"
          value={String(cycles)}
          icon={AlertTriangle}
          tone={cycles > 0 ? "risk" : "default"}
        />
        <MetricCard
          label="巨型模块"
          value={String(giants)}
          icon={Layers}
          tone={giants > 0 ? "risk" : "default"}
        />
        <MetricCard
          label="分层违规"
          value={String(layers)}
          icon={Layers}
          tone={layers > 0 ? "risk" : "default"}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        <span>上次扫描：{formatScannedAt(graph.scannedAt)}</span>
        {summary?.truncated && summary.filesDiscovered != null && (
          <span className="px-1.5 py-0.5 rounded border border-ai-blue/40 bg-ai-blue/10 text-ai-blue">
            已采样 {summary.fileCount}/{summary.filesDiscovered} 文件
          </span>
        )}
        {summary?.edgesTruncated && (
          <span className="px-1.5 py-0.5 rounded border border-risk-high/30 text-risk-high">
            依赖边已截断
          </span>
        )}
      </div>
    </div>
  )
}
