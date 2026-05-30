"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { RepoPrList } from "@/features/prism/components/repo-pr-list"
import { RepositoryBadges } from "@/features/prism/components/repository-badges"
import { isRepositoryManaged } from "@/lib/repos/is-repository-managed"
import { RepositoryOnboardingProgress } from "@/features/prism/components/repository-onboarding-progress"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useRepositoryOnboarding } from "@/hooks/use-repository-onboarding"
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
import { repoCategory } from "@/lib/repos-utils"
import { useRepositoryJobs } from "@/hooks/use-repository-jobs"
import { startRepoAnalyze } from "@/lib/api/repos"
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
  const { repoId: highlightedRepoId } = useNavigation()
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

  useEffect(() => {
    if (!highlightedRepoId || loading) return
    const el = document.getElementById(`repo-card-${highlightedRepoId}`)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [highlightedRepoId, loading, repos.length])

  const ownedRepos = useMemo(
    () => repos.filter((repo) => repoCategory(repo) === "owned"),
    [repos],
  )
  const managedRepos = useMemo(
    () => repos.filter((repo) => repoCategory(repo) === "managed"),
    [repos],
  )
  const externalRepos = useMemo(
    () => repos.filter((repo) => repoCategory(repo) === "external"),
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
          <h1 className="text-lg font-semibold text-foreground">{zh.nav.repos}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {zh.pageSubtitle.repos} · 同步合并请求后进入代码评审
          </p>
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

      {!loading && ownedRepos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {zh.repos.connectedReposSection}
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {ownedRepos.map((repo, idx) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                idx={idx}
                highlighted={repo.id === highlightedRepoId}
                analyzingRepoId={analyzingRepoId}
                removingRepoId={removingRepoId}
                analysisErrorsByRepoId={analysisErrorsByRepoId}
                analyzeRepository={analyzeRepository}
                removeRepo={removeRepo}
                onReposRefresh={refresh}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && managedRepos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {zh.repos.managedReposSection}
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {managedRepos.map((repo, idx) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                idx={idx}
                highlighted={repo.id === highlightedRepoId}
                analyzingRepoId={analyzingRepoId}
                removingRepoId={removingRepoId}
                analysisErrorsByRepoId={analysisErrorsByRepoId}
                analyzeRepository={analyzeRepository}
                removeRepo={removeRepo}
                onReposRefresh={refresh}
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
                highlighted={repo.id === highlightedRepoId}
                analyzingRepoId={analyzingRepoId}
                removingRepoId={removingRepoId}
                analysisErrorsByRepoId={analysisErrorsByRepoId}
                analyzeRepository={analyzeRepository}
                removeRepo={removeRepo}
                isExternal
                onReposRefresh={refresh}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function RepositoryJobBar({
  repoId,
  seedJob,
}: {
  repoId: string
  seedJob?: Repository["activeJob"]
}) {
  const pollJobs = Boolean(
    seedJob &&
      (seedJob.status === "running" ||
        seedJob.status === "pending" ||
        seedJob.jobType === "onboarding"),
  )
  const { latest, active } = useRepositoryJobs(repoId, pollJobs)
  const job = latest ?? seedJob
  const [starting, setStarting] = useState(false)

  if (!job && !active) return null

  const handleReanalyze = async () => {
    setStarting(true)
    try {
      await startRepoAnalyze(repoId, {
        types: ["architecture", "security", "performance", "repo_ai"],
      })
    } finally {
      setStarting(false)
    }
  }

  if (!job) return null

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-2">
        <span className="truncate">{job.message || zh.repoJobStatus[job.status]}</span>
        <span className="shrink-0">{job.progress ?? 0}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            job.status === "failed"
              ? "bg-risk-high"
              : job.status === "success"
                ? "bg-risk-low"
                : "bg-ai-blue",
          )}
          style={{ width: `${Math.min(100, job.progress ?? 0)}%` }}
        />
      </div>
      {!active && job.status !== "running" && job.status !== "pending" ? (
        <button
          type="button"
          disabled={starting}
          onClick={() => void handleReanalyze()}
          className="text-[11px] font-medium text-ai-blue hover:underline disabled:opacity-50"
        >
          {starting ? zh.repos.analyzingRepo : zh.repoJobStatus.reanalyze}
        </button>
      ) : null}
    </div>
  )
}

function ExternalRepoOnboardSection({
  repo,
  onReposRefresh,
}: {
  repo: Repository
  onReposRefresh: () => Promise<void>
}) {
  const { startOnboard, onboarding, onboardError, latest, phase } = useRepositoryOnboarding(
    repo.id,
    { resumeJob: repo.activeJob?.jobType === "onboarding" },
  )
  const completedRefreshRef = useRef(false)

  useEffect(() => {
    if (phase !== "completed") {
      completedRefreshRef.current = false
      return
    }
    if (completedRefreshRef.current) return
    completedRefreshRef.current = true
    void onReposRefresh()
  }, [phase, onReposRefresh])

  if (isRepositoryManaged(repo)) {
    return <RepositoryJobBar repoId={repo.id} seedJob={repo.activeJob} />
  }

  const showProgress =
    onboarding || Boolean(latest) || repo.activeJob?.jobType === "onboarding"
  const showOnboardButton =
    !onboarding && phase !== "completed" && !isRepositoryManaged(repo)

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      {showProgress ? <RepositoryOnboardingProgress job={latest ?? repo.activeJob} compact /> : null}
      {onboardError ? <p className="text-xs text-risk-high">{onboardError}</p> : null}
      {phase === "completed" ? (
        <p className="text-xs text-risk-low">{zh.adoptRepo.onboardingComplete}</p>
      ) : null}
      {showOnboardButton ? (
        <button
          type="button"
          disabled={onboarding}
          onClick={() => {
            void startOnboard().then(async (result) => {
              if (result) await onReposRefresh()
            })
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-ai-blue text-white hover:bg-[oklch(0.55_0.19_240)] disabled:opacity-50"
        >
          {onboarding ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : null}
          {zh.repos.onboardCta}
        </button>
      ) : null}
    </div>
  )
}

function RepoCard({
  repo,
  idx,
  highlighted = false,
  analyzingRepoId,
  removingRepoId,
  analysisErrorsByRepoId,
  analyzeRepository,
  removeRepo,
  isExternal = false,
  onReposRefresh,
}: {
  repo: Repository
  idx: number
  highlighted?: boolean
  analyzingRepoId: string | null
  removingRepoId: string | null
  analysisErrorsByRepoId: Record<string, string>
  analyzeRepository: (repoId: string) => Promise<void>
  removeRepo: (repoId: string) => Promise<void>
  isExternal?: boolean
  onReposRefresh: () => Promise<void>
}) {
  const isAnalyzing = analyzingRepoId === repo.id
  const isRemoving = removingRepoId === repo.id
  const analysisError = analysisErrorsByRepoId[repo.id]
  const analysisContent = repo.aiAnalysis?.content
  const hasAnalysis = Boolean(analysisContent)
  const showAnalysisPanel = isAnalyzing || hasAnalysis || Boolean(analysisError)
  const isPrivateRepo = repo.isPrivate === true
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

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
      id={`repo-card-${repo.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={cn(
        "p-4 rounded-lg bg-surface-2 border transition-colors",
        highlighted
          ? "border-ai-blue/60 ring-2 ring-ai-blue/30 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
          : "border-border hover:border-ai-blue/50",
      )}
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
            <RepositoryBadges
              sourceType={repo.sourceType}
              isManaged={repo.isManaged}
              managed={repo.managed}
              repositoryType={repo.repositoryType}
            />
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

      {isExternal ? (
        <ExternalRepoOnboardSection repo={repo} onReposRefresh={onReposRefresh} />
      ) : (
        <RepositoryJobBar repoId={repo.id} seedJob={repo.activeJob} />
      )}

      <RepoPrList repoId={repo.id} repoFullName={`${repo.owner}/${repo.name}`} />

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
