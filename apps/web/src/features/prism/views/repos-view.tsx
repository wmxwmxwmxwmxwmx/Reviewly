"use client"

import { motion } from "framer-motion"
import {
  BookOpen,
  GitBranch,
  Star,
  Clock,
  Settings,
  Loader2,
  BrainCircuit,
  RefreshCw,
  GitFork,
  Code2,
  ExternalLink,
} from "lucide-react"

import { AddRepoDialog } from "@/features/prism/components/add-repo-dialog"
import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { toast } from "@/hooks/use-toast"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

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
    importing,
    error,
    syncError,
    analyzingRepoId,
    analysisErrorsByRepoId,
    sync,
    importRepo,
    refresh,
    analyzeRepository,
  } = useReposStore()

  const handleSync = async () => {
    try {
      const result = await sync()
      toast({
        title: zh.repos.syncSuccess,
        description: `共同步 ${result?.synced ?? result?.syncedRepos ?? 0} 个仓库`,
      })
    } catch {
      toast({
        variant: "destructive",
        title: zh.repos.syncRepos,
        description: syncError ?? "同步失败",
      })
    }
  }

  const handleImport = async (url: string) => {
    try {
      await importRepo(url)
      toast({ title: zh.repos.importSuccess })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "添加失败"
      toast({
        variant: "destructive",
        title: zh.repos.addRepo,
        description: syncError ?? message,
      })
      throw e
    }
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">仓库管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.repos}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AddRepoDialog importing={importing} onImport={handleImport} />
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing || importing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BookOpen className="w-3.5 h-3.5" />
            )}
            {syncing ? "同步中…" : zh.repos.syncRepos}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-surface-2 rounded-md hover:bg-surface-3 disabled:opacity-60"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            {zh.repos.refresh}
          </button>
        </div>
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
        <p className="text-sm text-muted-foreground">
          暂无仓库。登录 GitHub 后点击「同步 GitHub 仓库」，或使用「添加仓库」粘贴仓库 URL。
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {repo.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={repo.avatarUrl}
                          alt=""
                          className="w-6 h-6 rounded-full shrink-0"
                        />
                      ) : null}
                      <span className="text-sm font-medium text-foreground font-mono truncate">
                        {repo.owner}/{repo.name}
                      </span>
                      {repo.htmlUrl ? (
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-ai-blue shrink-0"
                          aria-label={zh.repos.viewOnGitHub}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : null}
                    </div>
                    {repo.description ? (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {repo.description}
                      </p>
                    ) : null}
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">
                        {zh.repos.defaultBranch}：{repo.defaultBranch}
                      </span>
                      {repo.language ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground flex items-center gap-1">
                          <Code2 className="w-3 h-3" />
                          {repo.language}
                        </span>
                      ) : null}
                      {repo.aiReviewEnabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-ai-blue/20 text-ai-blue">
                          {zh.repos.aiAvailable}
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded",
                          hasAnalysis
                            ? "bg-risk-low/15 text-risk-low"
                            : "bg-surface-3 text-muted-foreground",
                        )}
                      >
                        {hasAnalysis ? zh.repos.aiAnalysisReady : zh.repos.aiAnalysisPending}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-1 hover:bg-surface-3 rounded transition-colors shrink-0"
                    aria-label="设置"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                  {repo.stars != null && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 opacity-70" />
                      {repo.stars} {zh.repos.stars}
                    </span>
                  )}
                  {repo.forks != null && (
                    <span className="flex items-center gap-1">
                      <GitFork className="w-3 h-3 opacity-70" />
                      {repo.forks} {zh.repos.forks}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {repo.openPrCount} {zh.repos.openPrs}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatSyncTime(repo.lastSyncTime || repo.pushedAt || "")}
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
