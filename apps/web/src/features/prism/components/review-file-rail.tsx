"use client"

import {
  AlertOctagon,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileCode,
  Info,
  TriangleAlert,
  Zap,
} from "lucide-react"
import type { AnalysisFinding, PullRequest, ReviewStatus } from "@reviewly/shared"

import {
  groupFindingsByFile,
  scrollTargetFromFinding,
  type FindingScrollTarget,
} from "@/features/prism/lib/map-findings-to-diff"
import {
  REVIEW_STATUS_LABELS,
  reviewStatusBadgeClass,
} from "@/features/prism/lib/review-status-utils"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

const severityIcon = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: TriangleAlert,
  low: Info,
} as const

interface ReviewFileRailProps {
  pr: PullRequest
  findings: AnalysisFinding[]
  reviewStatus?: ReviewStatus
  selectedFindingId?: string | null
  analyzing?: boolean
  hasAnalysis?: boolean
  onSelectFinding: (target: FindingScrollTarget) => void
  onAnalyze?: () => void
  open?: boolean
  onToggleOpen?: () => void
  className?: string
  /** Overlay drawer on mobile (always visible flex) */
  overlay?: boolean
}

export function ReviewFileRail({
  pr,
  findings,
  reviewStatus = "OPEN",
  selectedFindingId,
  analyzing,
  hasAnalysis,
  onSelectFinding,
  onAnalyze,
  open = true,
  onToggleOpen,
  className,
  overlay = false,
}: ReviewFileRailProps) {
  const groups = groupFindingsByFile(findings)
  const critical = findings.filter((f) => f.severity === "critical").length
  const high = findings.filter((f) => f.severity === "high").length

  if (!open && !overlay) {
    return (
      <aside
        className={cn(
          "hidden lg:flex flex-col w-10 shrink-0 border-r border-border bg-panel/80 items-center py-2",
          className,
        )}
      >
        <button
          type="button"
          onClick={onToggleOpen}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          aria-label="展开问题列表"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {findings.length > 0 ? (
          <span className="mt-2 text-[10px] font-mono text-risk-high writing-mode-vertical">
            {findings.length}
          </span>
        ) : null}
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        overlay ? "flex" : "hidden lg:flex",
        "flex-col w-[260px] xl:w-[280px] shrink-0 border-r border-border bg-panel/50 min-h-0",
        className,
      )}
    >
      <div className="shrink-0 px-3 py-2.5 border-b border-border space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">评审上下文</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
                  reviewStatusBadgeClass(reviewStatus),
                )}
              >
                {REVIEW_STATUS_LABELS[reviewStatus]}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {pr.filesChanged} 文件 · +{pr.additions} -{pr.deletions}
              </span>
            </div>
          </div>
          {onToggleOpen ? (
            <button
              type="button"
              onClick={onToggleOpen}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground shrink-0"
              aria-label="收起侧栏"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        {findings.length > 0 ? (
          <div className="flex flex-wrap gap-1 text-[10px]">
            {critical > 0 ? (
              <span className="px-1.5 py-0.5 rounded bg-risk-critical/15 text-risk-critical border border-risk-critical/25">
                严重 {critical}
              </span>
            ) : null}
            {high > 0 ? (
              <span className="px-1.5 py-0.5 rounded bg-risk-high/15 text-risk-high border border-risk-high/25">
                高危 {high}
              </span>
            ) : null}
            <span className="px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground border border-border">
              共 {findings.length} 项
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
          发现项
        </p>
        {groups.length === 0 ? (
          <div className="px-2 py-6 text-center space-y-3">
            <FileCode className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {hasAnalysis
                ? "规则扫描未发现明显问题"
                : "尚未执行分析，点击顶栏「开始分析」扫描变更"}
            </p>
            {!hasAnalysis && onAnalyze && !analyzing ? (
              <button
                type="button"
                onClick={onAnalyze}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ai-blue hover:underline"
              >
                <Zap className="w-3.5 h-3.5" />
                {zh.common.startAnalyze}
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map((group) => (
              <li key={group.file}>
                <p
                  className="text-[10px] font-mono text-muted-foreground truncate px-1 mb-1"
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
                            <span className="line-clamp-2 text-foreground">{f.title}</span>
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
        )}
      </div>
    </aside>
  )
}
