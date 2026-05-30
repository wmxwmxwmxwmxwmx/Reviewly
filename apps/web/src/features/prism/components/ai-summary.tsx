"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react"
import type { AiUsageMetrics } from "@reviewly/shared"
import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface StreamingTextProps {
  text: string
  streaming: boolean
}

function StreamingText({ text, streaming }: StreamingTextProps) {
  if (streaming && !text.trim()) {
    return <p className="text-[11px] text-muted-foreground">正在生成分析…</p>
  }
  return (
    <SummaryMarkdown
      content={text}
      mode={streaming ? "preview" : "full"}
    />
  )
}

interface AISummaryProps {
  scanning?: boolean
  streaming?: boolean
  model?: string
  generatedSummary?: string
  jobSummary?: string
  hasAnalysis?: boolean
  restoring?: boolean
  error?: string | null
  usage?: AiUsageMetrics
  onGoToSettings?: () => void
  /** Anchor id for in-page scroll from review bar */
  sectionId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Panel layout: compact header, deep section collapsed by default */
  variant?: "default" | "panel"
  /** Initial open state for deep section (panel defaults to false) */
  defaultDeepOpen?: boolean
}

export function AISummary({
  scanning = false,
  streaming = false,
  model = "claude-opus-4.6",
  generatedSummary,
  jobSummary,
  hasAnalysis = false,
  restoring = false,
  error,
  usage,
  onGoToSettings,
  sectionId = "pr-ai-summary-section",
  open,
  onOpenChange,
  variant = "default",
  defaultDeepOpen,
}: AISummaryProps) {
  const isPanel = variant === "panel"
  const showSettingsAction =
    Boolean(onGoToSettings) &&
    Boolean(error?.includes("系统设置") || error?.includes("API 密钥"))
  const initialOpen =
    defaultDeepOpen ??
    (isPanel ? false : Boolean(generatedSummary || jobSummary || error || hasAnalysis))
  const [internalOpen, setInternalOpen] = useState(initialOpen)
  const isControlled = open !== undefined
  const fullOpen = isControlled ? open : internalOpen
  const setFullOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }
  const summaryText = generatedSummary ?? jobSummary
  const busy = scanning || streaming

  const Wrapper = isPanel ? "div" : motion.div
  const wrapperProps = isPanel
    ? { id: sectionId, className: "rounded-lg border border-border bg-card overflow-hidden" }
    : {
        id: sectionId,
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, delay: 0.1 },
        className: "rounded-lg border border-border bg-card overflow-hidden scroll-mt-24",
      }

  return (
    <Wrapper {...wrapperProps}>
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-3 hover:bg-accent transition-colors",
          isPanel ? "px-3 py-2.5" : "px-5 py-3.5",
        )}
        onClick={() => setFullOpen(!fullOpen)}
      >
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative">
            <BrainCircuit className="w-4 h-4 text-ai-blue" />
            {busy && (
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-ai-blue"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>
          <span className={cn("font-semibold text-foreground", isPanel ? "text-xs" : "text-sm")}>
            {isPanel ? "详细报告" : "AI 摘要分析"}
          </span>
          {busy && (
            <div className="flex items-center gap-1 ml-1">
              <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
              <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
              <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{model}</span>
        {usage?.totalTokens ? (
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {usage.totalTokens.toLocaleString()} tok · ¥{usage.costCny.toFixed(4)}
          </span>
        ) : null}
        {fullOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      <AnimatePresence>
        {fullOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className={cn("border-t border-border", isPanel ? "px-3 pb-3 pt-1" : "px-5 pb-4 pt-1")}>
              {error && (
                <div className="flex flex-col gap-2 px-3 py-2 mb-3 rounded bg-risk-critical/10 border border-risk-critical/25 text-[11px] text-risk-critical">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                  {showSettingsAction && (
                    <button
                      type="button"
                      onClick={onGoToSettings}
                      className="self-start ml-5 text-[11px] font-medium text-ai-blue hover:underline"
                    >
                      前往系统设置
                    </button>
                  )}
                </div>
              )}
              {summaryText ? (
                <StreamingText text={summaryText} streaming={streaming} />
              ) : scanning ? (
                <p className="text-[11px] text-muted-foreground">正在执行规则扫描…</p>
              ) : streaming ? (
                <p className="text-[11px] text-muted-foreground">正在生成 AI 摘要…</p>
              ) : restoring ? (
                <p className="text-[11px] text-muted-foreground">{zh.common.restoreAnalysis}</p>
              ) : hasAnalysis ? (
                <p className="text-[11px] text-muted-foreground">{zh.common.loadingSummary}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">{zh.common.startAnalyzeHint}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Wrapper>
  )
}
