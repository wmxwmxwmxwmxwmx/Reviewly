"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react"
import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"
import { zh } from "@/lib/i18n/zh"

interface StreamingTextProps {
  text: string
  streaming: boolean
}

function StreamingText({ text, streaming }: StreamingTextProps) {
  if (streaming && !text.trim()) {
    return <p className="text-[11px] text-muted-foreground">正在生成分析…</p>
  }
  return <SummaryMarkdown content={text} />
}

interface AISummaryProps {
  streaming: boolean
  model?: string
  generatedSummary?: string
  jobSummary?: string
  hasAnalysis?: boolean
  restoring?: boolean
  error?: string | null
  onGoToSettings?: () => void
}

export function AISummary({
  streaming,
  model = "claude-opus-4.6",
  generatedSummary,
  jobSummary,
  hasAnalysis = false,
  restoring = false,
  error,
  onGoToSettings,
}: AISummaryProps) {
  const showSettingsAction =
    Boolean(onGoToSettings) &&
    Boolean(error?.includes("系统设置") || error?.includes("API 密钥"))
  const [fullOpen, setFullOpen] = useState(Boolean(generatedSummary || jobSummary || error || hasAnalysis))
  const summaryText = generatedSummary ?? jobSummary

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <button
        type="button"
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-accent transition-colors"
        onClick={() => setFullOpen(!fullOpen)}
      >
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative">
            <BrainCircuit className="w-4 h-4 text-ai-blue" />
            {streaming && (
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-ai-blue"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>
          <span className="text-sm font-semibold text-foreground">AI 摘要分析</span>
          {streaming && (
            <div className="flex items-center gap-1 ml-1">
              <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
              <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
              <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{model}</span>
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
            <div className="px-5 pb-4 pt-1 border-t border-border">
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
              ) : streaming ? (
                <p className="text-[11px] text-muted-foreground">正在执行规则扫描并生成 AI 摘要…</p>
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
    </motion.div>
  )
}
