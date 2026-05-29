"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return <h3 key={i} className="text-xs font-semibold text-foreground mt-2 first:mt-0">{line.slice(3)}</h3>
        }
        if (line.startsWith("> ")) {
          return (
            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded bg-[oklch(0.55_0.22_27/0.08)] border border-[oklch(0.55_0.22_27/0.2)] text-[11px] text-risk-high">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{line.slice(2)}</span>
            </div>
          )
        }
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground pl-2">
              <span className="mt-1 w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>') }} />
            </div>
          )
        }
        if (line.trim() === "") return null
        return (
          <p
            key={i}
            className="text-[11px] text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>').replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded bg-surface-3 text-[10px] font-mono text-ai-blue">$1</code>') }}
          />
        )
      })}
    </div>
  )
}

interface StreamingTextProps {
  text: string
  streaming: boolean
}

function StreamingText({ text, streaming }: StreamingTextProps) {
  if (streaming && !text.trim()) {
    return <p className="text-[11px] text-muted-foreground">正在生成分析…</p>
  }
  return <SimpleMarkdown text={text} />
}

interface AISummaryProps {
  streaming: boolean
  model?: string
  generatedSummary?: string
  jobSummary?: string
  hasAnalysis?: boolean
  error?: string | null
}

export function AISummary({
  streaming,
  model = "claude-opus-4.6",
  generatedSummary,
  jobSummary,
  hasAnalysis = false,
  error,
}: AISummaryProps) {
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
                <div className="flex items-start gap-2 px-3 py-2 mb-3 rounded bg-risk-critical/10 border border-risk-critical/25 text-[11px] text-risk-critical">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {summaryText ? (
                <StreamingText text={summaryText} streaming={streaming} />
              ) : streaming ? (
                <p className="text-[11px] text-muted-foreground">正在执行规则扫描并生成 AI 摘要…</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  点击右上角「开始分析」，将基于当前 PR 的 Diff 与规则扫描结果生成评审摘要。
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
