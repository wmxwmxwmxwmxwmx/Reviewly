"use client"

import { Loader2 } from "lucide-react"

import type { AnalysisPhase } from "@/hooks/use-review-layout"
import { cn } from "@/lib/utils"

interface ReviewProgressIndicatorProps {
  phase: AnalysisPhase
  chunkProgress?: { current: number; total: number }
  className?: string
}

const PHASE_LABEL: Record<AnalysisPhase, string> = {
  idle: "就绪",
  scanning: "规则扫描",
  summarizing: "AI 摘要生成",
  done: "分析完成",
  error: "分析异常",
}

export function ReviewProgressIndicator({
  phase,
  chunkProgress,
  className,
}: ReviewProgressIndicatorProps) {
  const busy = phase === "scanning" || phase === "summarizing"
  const pct =
    phase === "scanning" && chunkProgress && chunkProgress.total > 0
      ? Math.round((chunkProgress.current / chunkProgress.total) * 100)
      : phase === "summarizing"
        ? undefined
        : phase === "done"
          ? 100
          : 0

  if (phase === "idle" && !busy) {
    return null
  }

  return (
    <div
      className={cn(
        "hidden md:flex flex-col gap-1 min-w-[140px] max-w-[220px] flex-1",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[11px]">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-ai-blue shrink-0" /> : null}
        <span
          className={cn(
            "truncate",
            phase === "error" ? "text-risk-high" : busy ? "text-ai-blue" : "text-muted-foreground",
          )}
        >
          {PHASE_LABEL[phase]}
          {pct !== undefined && phase === "scanning" ? ` ${pct}%` : ""}
          {phase === "summarizing" ? "…" : ""}
        </span>
      </div>
      {busy ? (
        <div className="h-1 rounded-full bg-surface-4 overflow-hidden">
          <div
            className="h-full rounded-full bg-ai-blue transition-all duration-300"
            style={{
              width:
                phase === "summarizing"
                  ? "66%"
                  : pct !== undefined
                    ? `${pct}%`
                    : "30%",
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
