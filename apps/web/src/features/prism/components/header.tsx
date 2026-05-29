"use client"

import { useCallback, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Github,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Zap,
  Menu,
  PanelRight,
} from "lucide-react"
import { validateGitHubPrUrl } from "@/lib/github-pr-url"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import type { PullRequest } from "@reviewly/shared"

interface HeaderProps {
  prData: PullRequest
  analyzing: boolean
  hasAnalysis?: boolean
  onAnalyze: () => void
  onImportUrl: (url: string) => Promise<void>
  importing?: boolean
  importError?: string | null
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
  hasAnalysis = false,
  onAnalyze,
  onImportUrl,
  importing = false,
  importError = null,
  syncLabel,
  diffLoading = false,
  prLoading = false,
  onMenuClick,
  aiPanelOpen,
  onToggleAIPanel,
}: HeaderProps) {
  const [inputUrl, setInputUrl] = useState(prData.url ?? "")
  const [focused, setFocused] = useState(false)
  const [localUrlError, setLocalUrlError] = useState<string | null>(null)

  useEffect(() => {
    setInputUrl(prData.url ?? "")
  }, [prData.id, prData.url])

  const submitUrl = useCallback(async () => {
    const trimmed = inputUrl.trim()
    if (!trimmed || importing) return
    const validationError = validateGitHubPrUrl(trimmed)
    if (validationError) {
      setLocalUrlError(validationError)
      return
    }
    setLocalUrlError(null)
    await onImportUrl(trimmed)
  }, [inputUrl, importing, onImportUrl])

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-border bg-panel/95 backdrop-blur-sm shrink-0 shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
      <div className="flex items-center gap-3 sm:gap-4 h-[68px] px-4 sm:px-5 min-w-0">
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
        <div className="flex flex-col flex-1 max-w-[400px] min-w-0 gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium px-0.5">
            {zh.common.importPrUrl}
          </span>
          <div
            className={cn(
              "relative flex items-center gap-2 h-9 px-3 rounded-md border bg-surface-2 transition-all duration-200",
              focused
                ? "border-ai-blue shadow-[0_0_0_2px_rgba(56,189,248,0.15)]"
                : "border-border hover:border-border-strong",
              (importError || localUrlError) && "border-risk-high/50",
            )}
          >
            <Github className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value)
                if (localUrlError) setLocalUrlError(null)
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void submitUrl()
                }
              }}
              disabled={importing}
              placeholder={zh.common.importPrPlaceholder}
              aria-label={zh.common.importPrUrl}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0 font-mono text-xs disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void submitUrl()}
              disabled={importing || !inputUrl.trim()}
              className="shrink-0 p-0.5 rounded hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
              aria-label={importing ? zh.common.importingPr : zh.common.loadPr}
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 text-ai-blue animate-spin" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5 text-ai-blue" />
              )}
            </button>
          </div>
          {(localUrlError || importError) && (
            <p className="text-[11px] text-risk-high leading-snug px-0.5">
              {localUrlError ?? importError}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">{prData.repo}</span>
            <span className="shrink-0 text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-surface-3 border border-border">
              PR #{prData.number}
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono shrink-0">
            <span className="px-1.5 py-0.5 rounded bg-ai-blue/10 text-ai-blue border border-ai-blue/20">
              {prData.sourceBranch}
            </span>
            <ArrowRight className="w-3 h-3" />
            <span className="px-1.5 py-0.5 rounded bg-risk-low/10 text-risk-low border border-risk-low/20">
              {prData.targetBranch}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-risk-low" />
            <span>{syncLabel}</span>
          </div>

          <AnimatePresence mode="wait">
            {analyzing ? (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-1.5 text-[11px] text-ai-blue"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">AI 分析中...</span>
              </motion.div>
            ) : hasAnalysis ? (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-risk-low" />
                <span>{zh.common.analyzeDone}</span>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                <span>{zh.common.analyzeReady}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {prData.author ? (
            <div
              className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground"
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

          <motion.button
            onClick={onAnalyze}
            disabled={analyzing || importing || diffLoading || prLoading}
            className={cn(
              "relative flex items-center gap-2 px-4 h-8 rounded-md text-sm font-medium text-white transition-all duration-200 overflow-hidden",
              analyzing || importing || diffLoading || prLoading
                ? "bg-ai-blue-dim cursor-not-allowed"
                : "bg-ai-blue hover:bg-sky-300 text-primary-foreground shadow-[0_0_0_0_rgba(56,189,248,0.3)] hover:shadow-[0_0_18px_2px_rgba(56,189,248,0.32)]",
            )}
            whileHover={!analyzing && !importing && !diffLoading && !prLoading ? { scale: 1.02 } : {}}
            whileTap={!analyzing && !importing && !diffLoading && !prLoading ? { scale: 0.97 } : {}}
          >
            {!analyzing && !importing && (
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
                <span>分析中</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>{zh.common.startAnalyze}</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </header>
  )
}
