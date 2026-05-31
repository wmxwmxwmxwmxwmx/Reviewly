"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ExternalLink, Loader2, Bot, X } from "lucide-react"

import type { UnifiedFinding } from "@reviewly/shared"

import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"
import { Button } from "@/components/ui/button"
import {
  FINDINGS_SEVERITY_COLORS,
  FINDINGS_SEVERITY_LABELS,
  statusLabel,
} from "@/lib/findings-severity-display"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface FindingDetailDrawerProps {
  finding: UnifiedFinding
  aiText: string
  aiLoading: boolean
  aiError: string | null
  actionLoading?: boolean
  onRunAi: (finding: UnifiedFinding) => void
  onReopen: (finding: UnifiedFinding) => void
  onResolve: (finding: UnifiedFinding) => void
  onSaveNote: (finding: UnifiedFinding, note: string) => void
  onOpenPr?: (finding: UnifiedFinding) => void
  onClose?: () => void
}

function DetailField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

export function FindingDetailDrawer({
  finding,
  aiText,
  aiLoading,
  aiError,
  actionLoading = false,
  onRunAi,
  onReopen,
  onResolve,
  onSaveNote,
  onOpenPr,
  onClose,
}: FindingDetailDrawerProps) {
  const [noteDraft, setNoteDraft] = useState(finding.note ?? "")
  const sevColor = FINDINGS_SEVERITY_COLORS[finding.severity]
  const canStreamAi =
    finding.findingType === "security" || finding.findingType === "performance"
  const isClosed = finding.status === "resolved" || finding.status === "ignored"

  useEffect(() => {
    setNoteDraft(finding.note ?? "")
  }, [finding.id, finding.note])

  const impactText =
    finding.impact?.trim() ||
    (finding.findingType === "security" || finding.findingType === "performance"
      ? finding.description
      : "")

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="shrink-0 px-5 py-4 border-b border-border space-y-2 relative">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        )}
        <h2 className="text-base font-semibold text-foreground leading-snug pr-8">{finding.rule}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className="inline-flex px-1.5 py-0.5 rounded font-semibold"
            style={{
              color: sevColor,
              backgroundColor: `${sevColor}18`,
              border: `1px solid ${sevColor}40`,
            }}
          >
            {FINDINGS_SEVERITY_LABELS[finding.severity]}
          </span>
          <span className="text-muted-foreground">{finding.typeLabel}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{statusLabel(finding.status)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <dl className="space-y-4">
          <DetailField label="文件路径">
            <code className="text-xs font-mono break-all text-muted-foreground">{finding.file || "—"}</code>
          </DetailField>
          <DetailField label="代码位置">
            <span className="font-mono text-xs tabular-nums">
              {finding.line ? `Line ${finding.line}` : "—"}
            </span>
          </DetailField>
          <DetailField label="风险说明">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{finding.description}</p>
          </DetailField>
          {impactText && impactText !== finding.description && (
            <DetailField label="影响分析">
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {impactText}
              </p>
            </DetailField>
          )}
          {aiText && (
            <DetailField label={zh.findings.aiAnalysis}>
              <div className="rounded-md border border-border bg-surface-2 p-3 text-xs">
                <SummaryMarkdown content={aiText} />
              </div>
            </DetailField>
          )}
          {finding.suggestion && (
            <DetailField label="修复建议">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{finding.suggestion}</p>
            </DetailField>
          )}
          <DetailField label="关联 PR">
            {finding.pullRequestId && onOpenPr ? (
              <button
                type="button"
                onClick={() => onOpenPr(finding)}
                className="inline-flex items-center gap-1 text-ai-blue hover:underline text-sm"
              >
                {finding.repo} #{finding.prNumber}
                <ExternalLink className="size-3" />
              </button>
            ) : (
              <span className="text-muted-foreground">
                {finding.repo}
                {finding.prNumber ? ` #${finding.prNumber}` : ""}
              </span>
            )}
          </DetailField>
          <DetailField label="发现时间">
            <span className="tabular-nums text-muted-foreground">
              {finding.discoveredAt
                ? new Date(finding.discoveredAt).toLocaleString("zh-CN")
                : "—"}
            </span>
          </DetailField>
          <DetailField label="处理状态">
            <span>{statusLabel(finding.status)}</span>
          </DetailField>
          <DetailField label="备注">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              placeholder="添加处理备注…"
              className="w-full text-xs rounded-md border border-border bg-surface-2 px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ai-blue/40"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actionLoading || noteDraft === (finding.note ?? "")}
              className="mt-2 h-7 text-xs"
              onClick={() => onSaveNote(finding, noteDraft)}
            >
              保存备注
            </Button>
          </DetailField>
        </dl>

        {canStreamAi && !aiText && (
          <div className="mt-4 pt-4 border-t border-border">
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => onRunAi(finding)}
              className="inline-flex items-center gap-1.5 text-xs text-ai-blue hover:underline disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Bot className="size-3.5" />
              )}
              {finding.findingType === "security"
                ? zh.findings.aiSecurity
                : zh.findings.aiPerformance}
            </button>
            {aiError && <p className="text-risk-high text-[11px] mt-2">{aiError}</p>}
          </div>
        )}
      </div>

      <div className="shrink-0 px-5 py-3 border-t border-border flex flex-wrap gap-2 bg-surface-2/50">
        {isClosed ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={actionLoading}
            className="h-8 text-xs"
            onClick={() => onReopen(finding)}
          >
            重新打开
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={actionLoading || finding.status === "resolved"}
            className="h-8 text-xs"
            onClick={() => onResolve(finding)}
          >
            标记已处理
          </Button>
        )}
      </div>
    </div>
  )
}
