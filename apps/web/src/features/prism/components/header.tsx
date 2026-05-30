"use client"

import { motion } from "framer-motion"
import {
  ArrowRight,
  CheckCircle2,
  FolderGit2,
  Loader2,
  Menu,
  PanelRight,
  Zap,
} from "lucide-react"
import { RepositoryBadges } from "@/features/prism/components/repository-badges"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import type { PullRequest } from "@reviewly/shared"

interface HeaderProps {
  prData: PullRequest
  analyzing: boolean
  scanning?: boolean
  hasAnalysis?: boolean
  hasFindings?: boolean
  onAnalyze: () => void
  onRescan?: () => void
  syncLabel?: string
  diffLoading?: boolean
  prLoading?: boolean
  onMenuClick?: () => void
  aiPanelOpen?: boolean
  onToggleAIPanel?: () => void
}

export function Header({
  prData,
  analyzing,
  scanning = false,
  hasAnalysis = false,
  hasFindings = false,
  onAnalyze,
  onRescan,
  syncLabel,
  diffLoading = false,
  prLoading = false,
  onMenuClick,
  aiPanelOpen,
  onToggleAIPanel,
}: HeaderProps) {
  const { navigate } = useNavigation()

  const syncLooksSuccessful =
    Boolean(syncLabel) &&
    (syncLabel === zh.common.loaded ||
      syncLabel === zh.common.syncedFromGithub ||
      syncLabel === zh.common.importedFromGithub ||
      syncLabel === zh.common.syncComplete)

  const displayTitle = prData.displayName?.trim() || prData.title

  return (
    <header className="sticky top-0 z-30 flex flex-col gap-2 border-b border-border bg-panel/95 backdrop-blur-sm shrink-0 overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.20)] px-4 sm:px-5 py-2.5 min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0 pb-0.5">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors shrink-0 lg:hidden"
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        )}

        <div className="flex flex-col min-w-0 flex-1 basis-[12rem] gap-0.5">
          <p className="text-sm font-semibold text-foreground truncate">{displayTitle}</p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
            <span className="text-xs font-medium text-muted-foreground truncate max-w-[14rem] sm:max-w-xs">
              {prData.repo}
            </span>
            <RepositoryBadges sourceType={prData.sourceType} managed={prData.managed} />
            <span className="shrink-0 text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-surface-3 border border-border">
              PR #{prData.number}
            </span>
            {prData.repoId ? (
              <button
                type="button"
                onClick={() => navigate("repos", { repoId: prData.repoId })}
                title={zh.aiReview.openRepository}
                aria-label={zh.aiReview.openRepository}
                className="inline-flex items-center gap-1 shrink-0 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-ai-blue/40 hover:text-ai-blue transition-colors"
              >
                <FolderGit2 className="h-3 w-3 shrink-0" />
                <span className="hidden xl:inline">{zh.aiReview.openRepository}</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono shrink-0">
          <span
            className="max-w-[10rem] truncate px-1.5 py-0.5 rounded bg-ai-blue/10 text-ai-blue border border-ai-blue/20"
            title={prData.sourceBranch}
          >
            {prData.sourceBranch}
          </span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span
            className="max-w-[10rem] truncate px-1.5 py-0.5 rounded bg-risk-low/10 text-risk-low border border-risk-low/20"
            title={prData.targetBranch}
          >
            {prData.targetBranch}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0 ml-auto">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] max-w-[11rem]">
            {syncLooksSuccessful ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-risk-low" />
                <span className="text-muted-foreground truncate">{syncLabel}</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                <span className="text-muted-foreground truncate">
                  {syncLabel ?? zh.common.analyzeReady}
                </span>
              </>
            )}
          </div>

          <div className="min-h-[20px] shrink-0">
            {analyzing ? (
              <div className="flex items-center gap-1.5 text-[11px] text-ai-blue">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">
                  {scanning ? "规则扫描中…" : "AI 摘要生成中…"}
                </span>
              </div>
            ) : hasAnalysis ? (
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-risk-low" />
                <span>{zh.common.analyzeDone}</span>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                <span>{zh.common.analyzeReady}</span>
              </div>
            )}
          </div>

          {prData.author ? (
            <div
              className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0"
              title={`${zh.pr.reviewer} ${prData.author}`}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white bg-gradient-to-br from-ai-blue to-ai-purple border border-background">
                {prData.author.slice(0, 2).toUpperCase()}
              </div>
              <span className="max-w-[5rem] truncate">{prData.author}</span>
            </div>
          ) : null}

          {onToggleAIPanel && (
            <button
              type="button"
              onClick={onToggleAIPanel}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-md transition-colors shrink-0 xl:hidden",
                aiPanelOpen ? "bg-ai-blue/15 text-ai-blue" : "hover:bg-accent text-muted-foreground",
              )}
              aria-label="切换 AI 面板"
            >
              <PanelRight className="w-4 h-4" />
            </button>
          )}

          {onRescan && (
            <button
              type="button"
              onClick={onRescan}
              disabled={analyzing || diffLoading || prLoading}
              className={cn(
                "hidden sm:flex items-center h-8 px-3 rounded-md text-xs font-medium border border-border transition-colors shrink-0",
                analyzing || diffLoading || prLoading
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {zh.common.rescanAnalyze}
            </button>
          )}

          <motion.button
            type="button"
            onClick={onAnalyze}
            disabled={analyzing || diffLoading || prLoading}
            className={cn(
              "relative flex items-center gap-2 px-4 h-8 rounded-md text-sm font-medium text-white transition-all duration-200 overflow-hidden shrink-0",
              analyzing || diffLoading || prLoading
                ? "bg-ai-blue-dim cursor-not-allowed"
                : "bg-ai-blue hover:bg-sky-300 text-primary-foreground shadow-[0_0_0_0_rgba(56,189,248,0.3)] hover:shadow-[0_0_18px_2px_rgba(56,189,248,0.32)]",
            )}
            whileHover={!analyzing && !diffLoading && !prLoading ? { scale: 1.02 } : {}}
            whileTap={!analyzing && !diffLoading && !prLoading ? { scale: 0.97 } : {}}
          >
            {!analyzing && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              />
            )}
            {analyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{scanning ? "扫描中" : "生成中"}</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>{hasFindings ? zh.common.regenerateSummary : zh.common.startAnalyze}</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </header>
  )
}
