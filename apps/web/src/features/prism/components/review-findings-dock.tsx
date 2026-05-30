"use client"

import {
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileCode,
  Info,
  TriangleAlert,
  PlayCircle,
} from "lucide-react"
import type { AnalysisFinding } from "@reviewly/shared"

import {
  groupFindingsByFile,
  scrollTargetFromFinding,
  type FindingScrollTarget,
} from "@/features/prism/lib/map-findings-to-diff"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

const severityIcon = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: TriangleAlert,
  low: Info,
} as const

export type FindingsSeverityBuckets = {
  critical: AnalysisFinding[]
  warning: AnalysisFinding[]
  other: AnalysisFinding[]
}

export function bucketFindingsBySeverity(findings: AnalysisFinding[]): FindingsSeverityBuckets {
  const critical: AnalysisFinding[] = []
  const warning: AnalysisFinding[] = []
  const other: AnalysisFinding[] = []
  for (const f of findings) {
    if (f.severity === "critical") critical.push(f)
    else if (f.severity === "high" || f.severity === "medium") warning.push(f)
    else other.push(f)
  }
  return { critical, warning, other }
}

interface ReviewFindingsDockProps {
  findings: AnalysisFinding[]
  selectedFindingId?: string | null
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onSelectFinding: (target: FindingScrollTarget) => void
  hasAnalysis?: boolean
  analyzing?: boolean
  onAnalyze?: () => void
  className?: string
}

export function ReviewFindingsDock({
  findings,
  selectedFindingId,
  expanded,
  onExpandedChange,
  onSelectFinding,
  hasAnalysis = false,
  analyzing = false,
  onAnalyze,
  className,
}: ReviewFindingsDockProps) {
  const buckets = bucketFindingsBySeverity(findings)
  const groups = groupFindingsByFile(findings)
  const hasAny = findings.length > 0

  return (
    <div
      className={cn(
        "shrink-0 border-t border-border bg-panel/80 px-3 py-2 min-w-0",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {buckets.critical.length > 0 ? (
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-risk-critical/15 text-risk-critical border border-risk-critical/25 hover:bg-risk-critical/20 transition-colors"
          >
            <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
            Critical ({buckets.critical.length})
          </button>
        ) : null}
        {buckets.warning.length > 0 ? (
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-risk-high/15 text-risk-high border border-risk-high/25 hover:bg-risk-high/20 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Warning ({buckets.warning.length})
          </button>
        ) : null}
        {buckets.other.length > 0 ? (
          <button
            type="button"
            onClick={() => onExpandedChange(!expanded)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-surface-3 text-muted-foreground border border-border hover:bg-accent transition-colors"
          >
            <Info className="w-3.5 h-3.5 shrink-0" />
            Other ({buckets.other.length})
          </button>
        ) : null}

        {!hasAny ? (
          <span className="text-[11px] text-muted-foreground">
            {hasAnalysis ? "未发现明显问题" : "尚未扫描"}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {!hasAnalysis && onAnalyze && !analyzing ? (
            <button
              type="button"
              onClick={onAnalyze}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-ai-blue hover:underline"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {zh.common.startAnalyze}
            </button>
          ) : null}
          {hasAny ? (
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground"
              aria-label={expanded ? "收起发现项" : "展开发现项"}
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4 rotate-180" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      {expanded && hasAny ? (
        <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border bg-card/50 p-2">
          <ul className="space-y-2">
            {groups.map((group) => (
              <li key={group.file}>
                <p
                  className="text-[10px] font-mono text-muted-foreground truncate px-1 mb-0.5"
                  title={group.file}
                >
                  {group.file.split("/").pop() ?? group.file}
                </p>
                <ul className="space-y-0.5">
                  {group.findings.map((f) => {
                    const Icon = severityIcon[f.severity] ?? Info
                    const selected = selectedFindingId === f.id
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => onSelectFinding(scrollTargetFromFinding(f))}
                          className={cn(
                            "w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-md text-[11px] transition-colors",
                            selected
                              ? "bg-ai-blue/15 border border-ai-blue/30"
                              : "hover:bg-accent border border-transparent",
                          )}
                        >
                          <Icon
                            className={cn(
                              "w-3.5 h-3.5 shrink-0 mt-0.5",
                              f.severity === "critical" && "text-risk-critical",
                              f.severity === "high" && "text-risk-high",
                              f.severity === "medium" && "text-risk-medium",
                              f.severity === "low" && "text-risk-low",
                            )}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="line-clamp-1 text-foreground">{f.title}</span>
                            {f.line > 0 ? (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                L{f.line}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!hasAny && !hasAnalysis && !analyzing ? (
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <FileCode className="w-3.5 h-3.5 shrink-0 opacity-50" />
          <span>执行分析后在此查看按严重度分组的问题</span>
        </div>
      ) : null}
    </div>
  )
}
