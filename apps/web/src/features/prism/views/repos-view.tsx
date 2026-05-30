"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  GitBranch,
  Star,
  Clock,
  Loader2,
  BrainCircuit,
  RefreshCw,
  GitFork,
  Code2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react"

import { AddRepoDialog } from "@/features/prism/components/add-repo-dialog"
import { SummaryMarkdown } from "@/features/prism/components/summary-markdown"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { toast } from "@/hooks/use-toast"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import type { Repository } from "@reviewly/shared"

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
    removingRepoId,
    sync,
    importRepo,
    refresh,
    analyzeRepository,
    removeRepo,
  } = useReposStore()

  const connectedRepos = useMemo(
    () => repos.filter((repo) => (repo.sourceType ?? "github") === "github"),
    [repos],
  )
  const externalRepos = useMemo(
    () => repos.filter((repo) => repo.sourceType === "external"),
    [repos],
  )

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

      {!loading && connectedRepos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {zh.repos.connectedReposSection}
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {connectedRepos.map((repo, idx) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                idx={idx}
                analyzingRepoId={analyzingRepoId}
                removingRepoId={removingRepoId}
                analysisErrorsByRepoId={analysisErrorsByRepoId}
                analyzeRepository={analyzeRepository}
                removeRepo={removeRepo}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && externalRepos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {zh.repos.externalReposSection}
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {externalRepos.map((repo, idx) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                idx={idx}
                analyzingRepoId={analyzingRepoId}
                removingRepoId={removingRepoId}
                analysisErrorsByRepoId={analysisErrorsByRepoId}
                analyzeRepository={analyzeRepository}
                removeRepo={removeRepo}
                isExternal
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function RepoCard({
  repo,
  idx,
  analyzingRepoId,
  removingRepoId,
  analysisErrorsByRepoId,
  analyzeRepository,
  removeRepo,
  isExternal = false,
}: {
  repo: Repository
  idx: number
  analyzingRepoId: string | null
  removingRepoId: string | null
  analysisErrorsByRepoId: Record<string, string>
  analyzeRepository: (repoId: string) => Promise<void>
  removeRepo: (repoId: string) => Promise<void>
  isExternal?: boolean
}) {
  const health = repo.healthScore
  const isAnalyzing = analyzingRepoId === repo.id
  const isRemoving = removingRepoId === repo.id
  const analysisError = analysisErrorsByRepoId[repo.id]
  const analysisContent = repo.aiAnalysis?.content
  const hasAnalysis = Boolean(analysisContent)
  const showAnalysisPanel = isAnalyzing || hasAnalysis || Boolean(analysisError)
  const isPrivateRepo = repo.isPrivate === true
  const [analysisOpen, setAnalysisOpen] = useState(hasAnalysis)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (hasAnalysis) {
      setAnalysisOpen(true)
    }
  }, [hasAnalysis])

  const handleRemove = async () => {
    try {
      await removeRepo(repo.id)
      setConfirmOpen(false)
      toast({ title: zh.repos.removeRepoSuccess })
    } catch {
      /* error surfaced via syncError in parent */
    }
  }

  const removeDisabled = Boolean(analyzingRepoId) || Boolean(removingRepoId)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="p-4 rounded-lg bg-surface-2 border border-border hover:border-ai-blue/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
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
            {isExternal ? (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded bg-risk-medium/15 text-risk-medium border border-risk-medium/30"
                title={zh.repos.externalRepoHint}
              >
                {zh.repos.externalRepoBadge}
              </span>
            ) : null}
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
          {isExternal ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{zh.repos.externalRepoHint}</p>
          ) : null}
          {repo.description ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {repo.description}
            </p>
          ) : null}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border",
                isPrivateRepo
                  ? "bg-ai-purple/10 text-ai-purple border-ai-purple/25"
                  : "bg-surface-3 text-muted-foreground border-border",
              )}
            >
              {isPrivateRepo ? zh.repos.privateRepo : zh.repos.publicRepo}
            </span>
            {repo.owner ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground border border-border">
                {zh.repos.repoOwner}：{repo.owner}
              </span>
            ) : null}
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

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={removeDisabled}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md text-risk-high bg-risk-high/10 hover:bg-risk-high/20 border border-risk-high/25 shrink-0 disabled:opacity-50"
            >
              {isRemoving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              {zh.repos.removeRepo}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{zh.repos.removeRepoTitle}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-left">
                  <p>{zh.repos.removeRepoDescription}</p>
                  <p>
                    {isExternal
                      ? zh.repos.removeRepoRecoverExternal
                      : zh.repos.removeRepoRecoverConnected}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{zh.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                disabled={isRemoving}
                className="bg-risk-high hover:bg-risk-high/90"
                onClick={(event) => {
                  event.preventDefault()
                  void handleRemove()
                }}
              >
                {isRemoving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  zh.repos.removeRepoConfirm
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
          {analysisContent ? (
            <Collapsible open={analysisOpen} onOpenChange={setAnalysisOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  aria-expanded={analysisOpen}
                  aria-label={
                    analysisOpen ? zh.repos.collapseAnalysis : zh.repos.expandAnalysis
                  }
                >
                  <span>{zh.repos.repoAnalysisTitle}</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    {analysisOpen ? zh.repos.collapseAnalysis : zh.repos.expandAnalysis}
                    {analysisOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 text-xs max-h-64 overflow-y-auto">
                  <SummaryMarkdown content={analysisContent} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
      )}
    </motion.div>
  )
}
