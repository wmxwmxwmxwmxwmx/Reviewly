"use client"

import { Loader2 } from "lucide-react"

import type { ArchitectureScanProgress } from "@/lib/api/architecture"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

type ArchitectureScanProgressBarProps = {
  progress: ArchitectureScanProgress
  className?: string
}

function phaseLabel(phase: string): string {
  return zh.architecture.scanPhases[phase] ?? phase
}

export function ArchitectureScanProgressBar({
  progress,
  className,
}: ArchitectureScanProgressBarProps) {
  const detail =
    progress.total != null && progress.current != null
      ? `${progress.current} / ${progress.total}`
      : null

  return (
    <div
      className={cn(
        "rounded-lg border border-ai-blue/30 bg-ai-blue/5 px-4 py-3 space-y-2",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0 text-foreground">
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-ai-blue" />
          <span className="truncate">{progress.message}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
          <span className="hidden sm:inline">{phaseLabel(progress.phase)}</span>
          {detail && <span className="font-mono">{detail}</span>}
          <span className="font-medium text-ai-blue tabular-nums">{progress.percent}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-ai-blue transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(2, progress.percent)}%` }}
        />
      </div>
    </div>
  )
}
