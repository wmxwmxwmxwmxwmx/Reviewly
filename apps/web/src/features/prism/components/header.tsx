"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Github,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Zap,
  ChevronDown,
  Menu,
  PanelRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PRData } from "@/features/prism/data/mock-data"

interface HeaderProps {
  prData: PRData
  analyzing: boolean
  onAnalyze: () => void
  onMenuClick?: () => void
  aiPanelOpen?: boolean
  onToggleAIPanel?: () => void
}

const reviewers = [
  { initials: "LM", color: "from-ai-blue to-ai-purple" },
  { initials: "XH", color: "from-risk-low to-risk-info" },
  { initials: "WP", color: "from-risk-high to-risk-critical" },
]

export function Header({
  prData,
  analyzing,
  onAnalyze,
  onMenuClick,
  aiPanelOpen,
  onToggleAIPanel,
}: HeaderProps) {
  const [inputUrl, setInputUrl] = useState(prData.url)
  const [focused, setFocused] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 sm:gap-4 h-[68px] px-4 sm:px-5 border-b border-border bg-panel/95 backdrop-blur-sm shrink-0 shadow-[0_18px_50px_rgba(0,0,0,0.20)]">
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
      {/* PR URL Input */}
      <div
        className={cn(
          "relative flex items-center gap-2 flex-1 max-w-[400px] h-9 px-3 rounded-md border bg-surface-2 transition-all duration-200",
          focused
            ? "border-ai-blue shadow-[0_0_0_2px_rgba(56,189,248,0.15)]"
            : "border-border hover:border-border-strong"
        )}
      >
        <Github className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="https://github.com/user/repo/pull/2847"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0 font-mono text-xs"
        />
        <AnimatePresence>
          {inputUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              <ArrowRight className="w-3.5 h-3.5 text-ai-blue" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PR Meta */}
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

      {/* Right Controls */}
      <div className="flex items-center gap-3 shrink-0">
        {/* GitHub Sync */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-risk-low" />
          <span>同步完成</span>
        </div>

        {/* AI Status */}
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
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-risk-low" />
              <span>分析就绪</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reviewers */}
        <div className="hidden sm:flex items-center">
          {reviewers.map((r, i) => (
            <div
              key={r.initials}
              title={`Reviewer ${r.initials}`}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white bg-gradient-to-br border border-background",
                r.color
              )}
              style={{ marginLeft: i > 0 ? "-6px" : 0 }}
            >
              {r.initials}
            </div>
          ))}
          <ChevronDown className="w-3 h-3 text-muted-foreground ml-1" />
        </div>

        {onToggleAIPanel && (
          <button
            type="button"
            onClick={onToggleAIPanel}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-colors shrink-0 xl:hidden",
              aiPanelOpen ? "bg-ai-blue/15 text-ai-blue" : "hover:bg-accent text-muted-foreground"
            )}
            aria-label="切换 AI 面板"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}

        {/* Analyze Button */}
        <motion.button
          onClick={onAnalyze}
          disabled={analyzing}
          className={cn(
            "relative flex items-center gap-2 px-4 h-8 rounded-md text-sm font-medium text-white transition-all duration-200 overflow-hidden",
            analyzing
              ? "bg-ai-blue-dim cursor-not-allowed"
              : "bg-ai-blue hover:bg-sky-300 text-primary-foreground shadow-[0_0_0_0_rgba(56,189,248,0.3)] hover:shadow-[0_0_18px_2px_rgba(56,189,248,0.32)]"
          )}
          whileHover={!analyzing ? { scale: 1.02 } : {}}
          whileTap={!analyzing ? { scale: 0.97 } : {}}
        >
          {/* Shimmer */}
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
              <span>分析中</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              <span>开始分析</span>
            </>
          )}
        </motion.button>
      </div>
    </header>
  )
}
