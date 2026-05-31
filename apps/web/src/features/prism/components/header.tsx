"use client"

import { motion } from "framer-motion"
import {
  ArrowRight,
  ExternalLink,
  Loader2,
  Menu,
  PlayCircle,
} from "lucide-react"
import { RepositoryBadges } from "@/features/prism/components/repository-badges"
import type { AnalysisPhase } from "@/hooks/use-review-layout"
import { zh } from "@/lib/i18n/zh"
import { openGitHubReview } from "@/lib/github-pr-url"
import { cn } from "@/lib/utils"
import type { PullRequest } from "@reviewly/shared"

const PHASE_DOT_TITLE: Record<AnalysisPhase, string> = {
  idle: "就绪",
  scanning: "规则扫描中",
  summarizing: "AI 摘要生成中",
  done: "分析完成",
  error: "分析异常",
}

interface HeaderProps {
  prData: PullRequest
  analyzing: boolean
  scanning?: boolean
  hasAnalysis?: boolean
  hasFindings?: boolean
  onAnalyze: () => void
  onRescan?: () => void
  diffLoading?: boolean
  prLoading?: boolean
  onMenuClick?: () => void
  analysisPhase?: AnalysisPhase
  findingsCounts?: { critical: number; warning: number; other: number }
}

function PhaseDot({ phase }: { phase: AnalysisPhase }) {
  const busy = phase === "scanning" || phase === "summarizing"
  return (
    <span
      className="inline-flex items-center shrink-0"
      title={PHASE_DOT_TITLE[phase]}
    >
      {busy ? (
        <Loader2 className="w-2 h-2 animate-spin text-ai-blue" />
      ) : (
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            phase === "done" && "bg-risk-low",
            phase === "error" && "bg-risk-high",
            phase === "idle" && "bg-muted-foreground/40",
          )}
        />
      )}
    </span>
  )
}

export function Header({
  prData,
  analyzing,
  scanning = false,
  hasAnalysis: _hasAnalysis = false,
  hasFindings = false,
  onAnalyze,
  onRescan,
  diffLoading = false,
  prLoading = false,
  onMenuClick,
  analysisPhase = "idle",
  findingsCounts,
}: HeaderProps) {
  const displayTitle = prData.displayName?.trim() || prData.title

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-panel/95 backdrop-blur-sm px-3 sm:px-4 py-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent shrink-0 lg:hidden"
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{displayTitle}</p>
            <PhaseDot phase={analysisPhase} />
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground min-w-0">
            <span className="truncate max-w-[10rem] sm:max-w-xs">{prData.repo}</span>
            <RepositoryBadges
              sourceType={prData.sourceType}
              isManaged={prData.isManaged}
              managed={prData.managed}
              repositoryType={prData.repositoryType}
            />
            <span className="font-mono shrink-0">#{prData.number}</span>
            <span className="hidden sm:inline text-muted-foreground/60">·</span>
            <span
              className="hidden sm:inline truncate max-w-[8rem] font-mono text-ai-blue/90"
              title={prData.sourceBranch}
            >
              {prData.sourceBranch}
            </span>
            <ArrowRight className="hidden sm:inline w-3 h-3 shrink-0 opacity-50" />
            <span
              className="hidden sm:inline truncate max-w-[8rem] font-mono"
              title={prData.targetBranch}
            >
              {prData.targetBranch}
            </span>
          </div>
        </div>

        {findingsCounts && (findingsCounts.critical > 0 || findingsCounts.warning > 0) ? (
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {findingsCounts.critical > 0 ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-risk-critical/15 text-risk-critical border border-risk-critical/20 font-medium">
                {findingsCounts.critical}
              </span>
            ) : null}
            {findingsCounts.warning > 0 ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-risk-high/15 text-risk-high border border-risk-high/20 font-medium">
                {findingsCounts.warning}
              </span>
            ) : null}
          </div>
        ) : null}

        {onRescan && hasFindings ? (
          <button
            type="button"
            onClick={onRescan}
            disabled={analyzing || diffLoading || prLoading}
            className="hidden md:flex h-8 px-2 rounded-md text-[11px] border border-border text-muted-foreground hover:bg-accent shrink-0 disabled:opacity-50"
          >
            {zh.common.rescanAnalyze}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => openGitHubReview(prData)}
          className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          在 GitHub Review
        </button>

        <motion.button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing || diffLoading || prLoading}
          className={cn(
            "flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-white shrink-0",
            analyzing || diffLoading || prLoading
              ? "bg-ai-blue-dim cursor-not-allowed"
              : "bg-ai-blue hover:bg-sky-300",
          )}
          whileTap={!analyzing && !diffLoading && !prLoading ? { scale: 0.97 } : {}}
        >
          {analyzing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden xs:inline">{scanning ? "扫描" : "生成"}</span>
            </>
          ) : (
            <>
              <PlayCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {hasFindings ? zh.common.regenerateSummary : zh.common.startAnalyze}
              </span>
            </>
          )}
        </motion.button>
      </div>
    </header>
  )
}
