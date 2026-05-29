"use client"

import { Fragment } from "react"
import { motion } from "framer-motion"
import { ChevronRight, Loader2, Zap } from "lucide-react"

import type { PerformanceCenterFinding } from "@reviewly/shared"

import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"
import { formatPerfType } from "@/lib/perf-type-labels"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

export const perfSeverityConfig = {
  critical: { color: "text-[oklch(0.55_0.22_27)]", bg: "bg-[oklch(0.55_0.22_27/0.1)]", label: "严重" },
  high: { color: "text-risk-high", bg: "bg-[oklch(0.62_0.21_32/0.1)]", label: "高危" },
  medium: { color: "text-risk-medium", bg: "bg-[oklch(0.75_0.15_85/0.1)]", label: "中危" },
  low: { color: "text-muted-foreground", bg: "bg-surface-3", label: "低危" },
} as const

interface PerformanceFindingsTableProps {
  items: PerformanceCenterFinding[]
  loading: boolean
  expandedFindingId: string | null
  optimizingId: string | null
  optimizeText: string
  optimizeError: string | null
  onRowClick: (finding: PerformanceCenterFinding) => void
  onOptimizeClick: (finding: PerformanceCenterFinding) => void
  onRegenerate: (finding: PerformanceCenterFinding) => void
  onCollapse: () => void
  onCancelOptimize: () => void
}

function PerformanceOptimizeInline({
  finding,
  isOptimizing,
  optimizeText,
  optimizeError,
  onRegenerate,
  onCollapse,
  onCancel,
}: {
  finding: PerformanceCenterFinding
  isOptimizing: boolean
  optimizeText: string
  optimizeError: string | null
  onRegenerate: () => void
  onCollapse: () => void
  onCancel: () => void
}) {
  const displayText = optimizeText || finding.aiOptimization?.content || ""

  return (
    <div className="px-4 py-3 bg-surface-2/80 border-t border-border space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs space-y-1 min-w-0">
          <p className="font-medium text-foreground">
            {formatPerfType(finding.type)}
            {finding.repo && (
              <span className="text-muted-foreground font-normal">
                {" "}
                · {finding.repo}
                {finding.prNumber != null && (
                  <span className="text-ai-blue">#{finding.prNumber}</span>
                )}
              </span>
            )}
          </p>
          <p className="font-mono text-muted-foreground truncate">
            {finding.file}:{finding.line}
          </p>
          {finding.suggestion && (
            <p className="text-muted-foreground">建议：{finding.suggestion}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
        >
          {zh.performance.collapseOptimize}
        </button>
      </div>

      {isOptimizing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-ai-blue" />
          {zh.performance.generatingOptimize}
          <button type="button" onClick={onCancel} className="ml-auto text-risk-high hover:underline">
            {zh.common.cancel}
          </button>
        </div>
      )}

      {optimizeError && !isOptimizing && (
        <div className="space-y-2">
          <p className="text-sm text-risk-high">{optimizeError}</p>
          <button
            type="button"
            onClick={onRegenerate}
            className="text-xs text-ai-blue hover:underline"
          >
            {zh.actions.regenerate}
          </button>
        </div>
      )}

      {displayText && !isOptimizing && !optimizeError && (
        <div className="space-y-2">
          <div className="prose prose-invert max-w-none text-sm max-h-80 overflow-y-auto">
            <SummaryMarkdown content={displayText} />
          </div>
          <button
            type="button"
            onClick={onRegenerate}
            className="text-xs text-ai-blue hover:underline"
          >
            {zh.actions.regenerate}
          </button>
        </div>
      )}
    </div>
  )
}

export function PerformanceFindingsTable({
  items,
  loading,
  expandedFindingId,
  optimizingId,
  optimizeText,
  optimizeError,
  onRowClick,
  onOptimizeClick,
  onRegenerate,
  onCollapse,
  onCancelOptimize,
}: PerformanceFindingsTableProps) {
  if (loading) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">{zh.common.loading}</p>
  }

  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">暂无性能发现。</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-2 border-b border-border text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">{zh.common.type}</th>
            <th className="px-4 py-2 font-medium">{zh.common.severity}</th>
            <th className="px-4 py-2 font-medium">{zh.common.repoPr}</th>
            <th className="px-4 py-2 font-medium">{zh.common.location}</th>
            <th className="px-4 py-2 font-medium">{zh.common.description}</th>
            <th className="px-4 py-2 font-medium w-28">{zh.common.actions}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((row, idx) => {
            const sev = perfSeverityConfig[row.severity]
            const isExpanded = expandedFindingId === row.id
            const isOptimizing = optimizingId === row.id
            const isBusyElsewhere = Boolean(optimizingId && optimizingId !== row.id)

            return (
              <Fragment key={row.id}>
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className={cn(
                    "hover:bg-surface-2/50 group",
                    isExpanded && "bg-surface-2/30",
                  )}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatPerfType(row.type)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
                        sev.bg,
                        sev.color,
                      )}
                    >
                      {sev.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <button
                      type="button"
                      className="hover:text-foreground text-left"
                      onClick={() => onRowClick(row)}
                    >
                      {row.repo}
                      <span className="text-ai-blue">#{row.prNumber}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {row.file}:{row.line}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={row.description}>
                    {row.description}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOptimizeClick(row)
                        }}
                        disabled={isBusyElsewhere}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-surface-3 text-ai-blue hover:bg-surface-2 disabled:opacity-50 min-w-[4.5rem] justify-center"
                      >
                        {isOptimizing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        {isOptimizing
                          ? zh.performance.optimizing
                          : isExpanded
                            ? zh.performance.collapseOptimize
                            : zh.actions.aiOptimize}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRowClick(row)}
                        className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground"
                        aria-label={zh.actions.openPrReview}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <PerformanceOptimizeInline
                        finding={row}
                        isOptimizing={isOptimizing}
                        optimizeText={expandedFindingId === row.id ? optimizeText : ""}
                        optimizeError={expandedFindingId === row.id ? optimizeError : null}
                        onRegenerate={() => onRegenerate(row)}
                        onCollapse={onCollapse}
                        onCancel={onCancelOptimize}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
