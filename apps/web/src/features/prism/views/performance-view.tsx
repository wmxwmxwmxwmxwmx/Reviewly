"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { Gauge, Search, Zap, ChevronLeft, ChevronRight } from "lucide-react"

import { PerformanceFindingsTable, perfSeverityConfig } from "@/features/prism/components/performance-findings-table"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { usePerformanceCenter } from "@/hooks/use-performance-center"
import { useRepos } from "@/hooks/use-repos"
import { zh } from "@/lib/i18n/zh"
import { formatPerfType, PERF_TYPE_FILTER_OPTIONS } from "@/lib/perf-type-labels"
import { cn } from "@/lib/utils"

const SEVERITY_OPTIONS = ["", "critical", "high", "medium", "low"] as const

export function PerformanceView() {
  const { navigate } = useNavigation()
  const { repos } = useRepos()
  const {
    items,
    total,
    page,
    totalPages,
    setPage,
    stats,
    loading,
    error,
    reload,
    severityFilter,
    setSeverityFilter,
    typeFilter,
    setTypeFilter,
    repoFilter,
    setRepoFilter,
    searchInput,
    setSearchInput,
    filtersOpen,
    setFiltersOpen,
    groupedByType,
    expandedFindingId,
    optimizingId,
    optimizeText,
    optimizeError,
    startOptimize,
    regenerateOptimize,
    collapseOptimize,
    cancelOptimize,
  } = usePerformanceCenter()

  const metrics = useMemo(
    () => [
      { label: zh.performance.openFindings, value: stats ? String(stats.openFindings) : "—" },
      {
        label: zh.performance.avgImpact,
        value: stats?.avgImpact ?? "—",
        impactClass:
          stats?.avgImpact === "high"
            ? "text-risk-high"
            : stats?.avgImpact === "medium"
              ? "text-risk-medium"
              : "text-risk-low",
      },
      { label: zh.performance.status, value: stats?.status ?? "—" },
    ],
    [stats],
  )

  const goToPr = (finding: { pullRequestId?: string }) => {
    if (finding.pullRequestId) {
      navigate("ai-review", { prId: finding.pullRequestId })
    }
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">性能分析</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.performance}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索类型、文件、描述…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-52 h-8 pl-8 pr-3 text-xs bg-surface-2 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ai-blue"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-surface-2 rounded-md hover:bg-surface-3"
          >
            {filtersOpen ? zh.common.collapseFilters : zh.common.filter}
          </button>
          <button
            type="button"
            onClick={() => navigate("pull-requests")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:opacity-90"
          >
            <Gauge className="w-3.5 h-3.5" />
            {zh.actions.goToPrList}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{zh.common.severity}</span>
            {SEVERITY_OPTIONS.map((s) => (
              <button
                key={s || "all-sev"}
                type="button"
                onClick={() => setSeverityFilter(s)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium border",
                  severityFilter === s
                    ? "border-ai-blue text-ai-blue bg-[oklch(0.62_0.19_240/0.1)]"
                    : "border-border text-muted-foreground hover:bg-surface-2",
                )}
              >
                {s ? perfSeverityConfig[s as keyof typeof perfSeverityConfig]?.label ?? s : zh.common.all}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{zh.common.type}</span>
            {PERF_TYPE_FILTER_OPTIONS.map((t) => (
              <button
                key={t || "all-type"}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium border",
                  typeFilter === t
                    ? "border-risk-medium text-risk-medium bg-[oklch(0.75_0.15_85/0.1)]"
                    : "border-border text-muted-foreground hover:bg-surface-2",
                )}
              >
                {t ? formatPerfType(t) : zh.common.all}
              </button>
            ))}
            <select
              value={repoFilter}
              onChange={(e) => setRepoFilter(e.target.value)}
              className="ml-2 h-7 text-xs bg-surface-2 border border-border rounded-md px-2 text-foreground"
            >
              <option value="">{zh.common.allRepos}</option>
              {repos.map((r) => (
                <option key={r.id} value={r.fullName}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>
          {groupedByType.size > 0 && (
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <span>{zh.performance.currentPageTypes}</span>
              {[...groupedByType.entries()].map(([type, count]) => (
                <span key={type} className="px-1.5 py-0.5 rounded bg-surface-2 border border-border">
                  {formatPerfType(type)} ({count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-risk-high/30 bg-risk-high/10 px-4 py-3 text-sm text-risk-high flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => reload()}
            className="text-xs underline shrink-0 ml-3"
          >
            重试
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 rounded-lg bg-surface-2 border border-border"
          >
            <div className="text-xs text-muted-foreground">{metric.label}</div>
            <div
              className={cn(
                "text-2xl font-semibold mt-1",
                "impactClass" in metric ? metric.impactClass : "text-foreground",
              )}
            >
              {metric.value}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-risk-medium" />
            <span className="text-sm font-medium text-foreground">{zh.performance.findingsTitle}</span>
            <span className="text-xs text-muted-foreground">{zh.common.recordsCount(total, loading)}</span>
          </div>
        </div>

        <PerformanceFindingsTable
          items={items}
          loading={loading}
          expandedFindingId={expandedFindingId}
          optimizingId={optimizingId}
          optimizeText={optimizeText}
          optimizeError={optimizeError}
          onRowClick={goToPr}
          onOptimizeClick={startOptimize}
          onRegenerate={regenerateOptimize}
          onCollapse={collapseOptimize}
          onCancelOptimize={cancelOptimize}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-2">
            <span className="text-xs text-muted-foreground">{zh.common.pageOf(page, totalPages)}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded hover:bg-surface-3 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded hover:bg-surface-3 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
