"use client"

import { Loader2, Sparkles, X } from "lucide-react"

import type { SecurityCenterFinding } from "@reviewly/shared"

import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface SecurityExplainPanelProps {
  finding: SecurityCenterFinding | null
  open: boolean
  onOpenChange: (open: boolean) => void
  explainText: string
  explainError: string | null
  explaining: boolean
  onExplain: () => void
  onCancel: () => void
}

export function SecurityExplainPanel({
  finding,
  open,
  onOpenChange,
  explainText,
  explainError,
  explaining,
  onExplain,
  onCancel,
}: SecurityExplainPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg bg-panel border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">{zh.security.explainTitle}</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            {finding ? `${finding.rule} · ${finding.repo}#${finding.prNumber}` : ""}
          </SheetDescription>
        </SheetHeader>

        {finding && (
          <div className="mt-4 space-y-4">
            <div className="rounded-md border border-border bg-surface-2 p-3 text-xs space-y-1">
              <p className="font-mono text-muted-foreground">
                {finding.file}:{finding.line}
              </p>
              <p className="text-foreground">{finding.description}</p>
              {finding.suggestion && (
                <p className="text-muted-foreground">建议：{finding.suggestion}</p>
              )}
            </div>

            {!explainText && !explaining && !explainError && (
              <button
                type="button"
                onClick={onExplain}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-ai-blue rounded-md hover:opacity-90"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {zh.actions.generateAiExplain}
              </button>
            )}

            {explaining && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-ai-blue" />
                正在流式生成…
                <button type="button" onClick={onCancel} className="ml-auto text-risk-high hover:underline">
                  {zh.common.cancel}
                </button>
              </div>
            )}

            {explainError && (
              <p className={cn("text-sm text-risk-high")}>{explainError}</p>
            )}

            {explainText && (
              <div className="prose prose-invert max-w-none text-sm">
                <SummaryMarkdown content={explainText} />
              </div>
            )}

            {explainText && !explaining && (
              <button
                type="button"
                onClick={onExplain}
                className="text-xs text-ai-blue hover:underline"
              >
                {zh.actions.regenerate}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 sr-only"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </SheetContent>
    </Sheet>
  )
}
