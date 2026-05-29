"use client"

import { motion } from "framer-motion"
import { BookOpen, GitBranch, Star, Clock, Settings, Loader2, BrainCircuit } from "lucide-react"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"

function formatSyncTime(iso: string) {
  if (!iso) return "未同步"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

export function ReposView() {
  const {
    repos,
    loading,
    syncing,
    error,
    syncError,
    analyzingRepoId,
    analysisErrorsByRepoId,
    sync,
    analyzeRepository,
  } = useReposStore()

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">仓库管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{zh.repos.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors disabled:opacity-60"
        >
          {syncing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <BookOpen className="w-3.5 h-3.5" />
          )}
          {syncing ? "同步中…" : zh.repos.syncRepos}
        </button>
      </div>

      {(error || syncError) && (
        <p className="text-sm text-risk-high">{error ?? syncError}</p>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载仓库…
        </p>
      )}

      {!loading && repos.length === 0 && (
        <p className="text-sm text-muted-foreground">暂无仓库，请点击「同步仓库」从 GitHub 拉取。</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {!loading &&
          repos.map((repo, idx) => {
            const health = repo.healthScore
            const isAnalyzing = analyzingRepoId === repo.id
            const analysisError = analysisErrorsByRepoId[repo.id]
            const analysisContent = repo.aiAnalysis?.content
            const hasAnalysis = Boolean(analysisContent)
            const showAnalysisPanel = isAnalyzing || hasAnalysis || Boolean(analysisError)

            return (
              <motion.div
                key={repo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-lg bg-surface-2 border border-border hover:border-ai-blue/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground font-mono">
                      {repo.owner}/{repo.name}
                    </span>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">
                        {zh.repos.defaultBranch}：{repo.defaultBranch}
                      </span>
                      {repo.aiReviewEnabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-ai-blue/20 text-ai-blue">
                          {zh.repos.aiAvailable}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-1 hover:bg-surface-3 rounded transition-colors"
                    aria-label="设置"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 opacity-70" />
                    {repo.openPrCount} PR
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {repo.defaultBranch}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatSyncTime(repo.lastSyncTime)}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{zh.repos.health}</span>
                    <span
                      className={cn(
                        "font-medium",
                        health >= 85 ? "text-risk-low" : health >= 70 ? "text-risk-medium" : "text-risk-high",
                      )}
                    >
                      {health}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        health >= 85 ? "bg-risk-low" : health >= 70 ? "bg-risk-medium" : "bg-risk-high",
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${health}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.1 }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void analyzeRepository(repo.id)}
                    disabled={Boolean(analyzingRepoId)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-ai-blue/15 text-ai-blue hover:bg-ai-blue/25 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <BrainCircuit className="w-3.5 h-3.5" />
                    )}
                    {isAnalyzing
                      ? zh.repos.analyzingRepo
                      : hasAnalysis
                        ? zh.actions.regenerate
                        : zh.actions.analyzeRepo}
                  </button>
                </div>

                {showAnalysisPanel && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {analysisError && (
                      <p className="text-xs text-risk-high mb-2">{analysisError}</p>
                    )}
                    {isAnalyzing && !analysisContent && (
                      <p className="text-xs text-muted-foreground">{zh.repos.generatingAnalysis}</p>
                    )}
                    {analysisContent && (
                      <div className="text-xs max-h-64 overflow-y-auto">
                        <SummaryMarkdown content={analysisContent} />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
      </div>
    </div>
  )
}
