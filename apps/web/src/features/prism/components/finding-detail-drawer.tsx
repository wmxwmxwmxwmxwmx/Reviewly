"use client"

import { Loader2, RefreshCw, Sparkles, X } from "lucide-react"

import type { UnifiedFinding } from "@reviewly/shared"

import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"
import { severityConfig } from "@/features/prism/components/security-findings-table"
import { Button } from "@/components/ui/button"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface FindingDetailDrawerProps {
  finding: UnifiedFinding | null
  aiText: string
  aiLoading: boolean
  aiError: string | null
  actionLoading?: boolean
  onClose: () => void
  onRunAi: (finding: UnifiedFinding) => void
  onReanalyze: (finding: UnifiedFinding) => void
  onIgnore: (finding: UnifiedFinding) => void
  onResolve: (finding: UnifiedFinding) => void
  onOpenPr?: (finding: UnifiedFinding) => void
}

export function FindingDetailDrawer({
  finding,
  aiText,
  aiLoading,
  aiError,
  actionLoading = false,
  onClose,
  onRunAi,
  onReanalyze,
  onIgnore,
  onResolve,
  onOpenPr,
}: FindingDetailDrawerProps) {
  if (!finding) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-sm text-muted-foreground">
        {zh.findings.selectFinding}
      </div>
    )
  }

  const sev = severityConfig[finding.severity] ?? severityConfig.low
  const aiLabel =
    finding.findingType === "security"
      ? zh.findings.aiSecurity
      : finding.findingType === "performance"
        ? zh.findings.aiPerformance
        : zh.findings.aiAnalysis

  const canStreamAi =
    finding.findingType === "security" || finding.findingType === "performance"

  return (
    <div className="flex flex-col h-full border-l border-border bg-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{finding.rule}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {finding.repo} · #{finding.prNumber}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        <div className="flex flex-wrap gap-2">
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", sev.bg, sev.color)}>
            {sev.label}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-3 text-muted-foreground">
            {finding.typeLabel}
          </span>
          {finding.status && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-3 text-muted-foreground">
              {finding.status}
            </span>
          )}
        </div>

        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1">{zh.findings.ruleDesc}</p>
          <p className="text-foreground leading-relaxed">{finding.description}</p>
        </div>

        {finding.suggestion && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1">{zh.common.suggestion}</p>
            <p className="text-foreground leading-relaxed">{finding.suggestion}</p>
          </div>
        )}

        <p className="font-mono text-muted-foreground break-all">
          {finding.file}
          {finding.line ? `:${finding.line}` : ""}
        </p>

        {onOpenPr && finding.pullRequestId && (
          <button
            type="button"
            onClick={() => onOpenPr(finding)}
            className="text-ai-blue hover:underline text-xs"
          >
            {zh.actions.openPrReview}
          </button>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={actionLoading || !finding.pullRequestId}
            onClick={() => onReanalyze(finding)}
            className="gap-1.5 h-8 text-xs"
          >
            {actionLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {zh.findings.reanalyze}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={actionLoading || finding.status === "ignored"}
            onClick={() => onIgnore(finding)}
            className="h-8 text-xs"
          >
            {zh.findings.ignore}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={actionLoading || finding.status === "resolved"}
            onClick={() => onResolve(finding)}
            className="h-8 text-xs"
          >
            {zh.findings.markResolved}
          </Button>
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          {canStreamAi ? (
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => onRunAi(finding)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ai-blue/10 text-ai-blue text-xs hover:bg-ai-blue/15 disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {aiLabel}
            </button>
          ) : (
            <p className="text-[11px] text-muted-foreground">{zh.findings.aiAnalysisHint}</p>
          )}
          {aiError && <p className="text-risk-high text-[11px]">{aiError}</p>}
          {aiText && (
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-2">
                {zh.findings.aiAnalysis}
              </p>
              <SummaryMarkdown content={aiText} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
