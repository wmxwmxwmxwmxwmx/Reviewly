"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AnalysisFinding, AiUsageMetrics, GovernanceRule } from "@reviewly/shared"
import { Loader2 } from "lucide-react"
import { Header } from "@/features/prism/components/header"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useAIReviewSession } from "@/features/prism/contexts/ai-review-session-context"
import { computeInboxItems } from "@/features/prism/ai/review-attention-score"
import { DiffViewer } from "@/features/prism/components/diff-viewer"
import {
  bucketFindingsBySeverity,
  ReviewFindingsDock,
} from "@/features/prism/components/review-findings-dock"
import { ReviewInsightDrawer } from "@/features/prism/components/review-insight-drawer"
import { ReviewCompletionBanner } from "@/features/prism/components/review-completion-banner"
import { ReviewPageSkeleton } from "@/features/prism/components/review-page-skeleton"
import { enrichDiffFilesWithFindings } from "@/features/prism/lib/map-findings-to-diff"
import { enrichTasksWithOpinion } from "@/features/prism/lib/review-task-verdict"
import {
  getFingerprintInput,
  markReviewed,
} from "@/features/prism/lib/review-attention-state"
import { readPrioritySettings } from "@/features/prism/lib/governance-priority-settings"
import { buildAiReviewerOpinion, isPrAnalysisComplete } from "@/lib/ai/ai-reviewer-opinion"
import { deriveAnalysisPhase, useReviewLayout } from "@/hooks/use-review-layout"
import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { usePullRequest } from "@/hooks/use-pull-request"
import { usePullRequestDiff } from "@/hooks/use-pull-request-diff"
import { usePrAnalysis } from "@/hooks/use-pr-analysis"
import { patchPrAiSummary } from "@/lib/api/ai-chat"
import { PENDING_AUTO_ANALYZE_KEY } from "@/hooks/use-import-pr-by-url"
import { useRunningTask } from "@/features/prism/contexts/running-tasks-context"
import { buildBoundedDiffContext, PROMPT_BUDGET } from "@/lib/ai/prompt-budget"
import { isAiSummaryStale } from "@/lib/ai/ai-review-consistency"
import {
  buildAiSummaryPersistPayload,
  generateAiReviewSummary,
} from "@/lib/ai/ai-review-summary"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { formatPrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"
import { AdoptRepoBanner, shouldShowAdoptBanner } from "@/features/prism/components/adopt-repo-banner"
import { ReviewCopilotPanel } from "@/features/prism/components/review-copilot-panel"
import { usePullRequestGovernance } from "@/hooks/use-pull-request-governance"
import { fetchPullRequestGovernance } from "@/lib/api/governance"
import {
  resolveAnalysisPanelState,
  resolveRunningLabel,
} from "@/features/prism/lib/analysis-panel-state"
import { useReposStore } from "@/features/prism/contexts/repos-context"

interface AIReviewViewProps {
  prId: string
  onReviewStatusChanged?: () => void
}

export function AIReviewView({ prId, onReviewStatusChanged }: AIReviewViewProps) {
  const { navigate } = useNavigation()
  const { refresh: refreshRepos, repos } = useReposStore()
  const { settings, hasApiKey, recordUsage } = useAISettings()
  const {
    getSession,
    patchSession,
    hasCachedSession,
    setLastReviewedPrId,
  } = useAIReviewSession()

  const cached = getSession(prId)
  const { data: pr, loading: prLoading, error: prError, reload: reloadPr, patchLocal } =
    usePullRequest(prId)
  const { files: diffFiles, loading: diffLoading, error: diffError } = usePullRequestDiff(prId)
  const {
    findings,
    latest,
    job,
    aiSummary,
    loadingPersisted,
    persistError,
    loadPersisted,
    runAnalysis,
    abortLoad,
    setJob,
    setAiSummary,
  } = usePrAnalysis(prId, {
    findings: cached.findings,
    latest: cached.latest,
    job: cached.job,
  })

  const [scanning, setScanning] = useState(false)
  const [summaryStreaming, setSummaryStreaming] = useState(false)
  const analyzing = scanning || summaryStreaming
  const [syncLabel, setSyncLabel] = useState(cached.syncLabel ?? zh.common.analyzeReady)
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 1 })
  const [generatedSummary, setGeneratedSummary] = useState<string | undefined>(
    cached.generatedSummary,
  )
  const [analysisError, setAnalysisError] = useState<string | null>(
    cached.analysisError ?? null,
  )
  const [reviewTimelineKey] = useState(0)
  const [runUsage, setRunUsage] = useState<AiUsageMetrics | undefined>(aiSummary?.usage)
  const layout = useReviewLayout()

  const analyzeAbortRef = useRef<AbortController | null>(null)
  const handleRescanRef = useRef<((options?: { force?: boolean }) => Promise<void>) | null>(null)

  useRunningTask("aiReview", analyzing)

  useEffect(() => {
    setLastReviewedPrId(prId)
  }, [prId, setLastReviewedPrId])

  useEffect(() => {
    if (!pr) return
    markReviewed(pr.id, getFingerprintInput(pr))
  }, [pr])

  useEffect(() => {
    abortLoad()
    const controller = new AbortController()
    void loadPersisted(controller.signal).catch(() => {
      /* persistError 已由 hook 记录 */
    })
    return () => controller.abort()
  }, [prId, loadPersisted, abortLoad])

  useEffect(() => {
    if (loadingPersisted || !aiSummary?.content) return
    const version = pr?.analysisVersion ?? job?.analysisVersion ?? null
    if (isAiSummaryStale(aiSummary, version)) return
    setGeneratedSummary((current) => current ?? aiSummary.content)
    if (aiSummary.usage) {
      setRunUsage(aiSummary.usage)
    }
  }, [aiSummary, pr?.analysisVersion, job?.analysisVersion, loadingPersisted])

  useEffect(() => {
    if (loadingPersisted || analyzing) return
    const complete = isPrAnalysisComplete({
      findings,
      generatedSummary,
      latest,
    })
    if (complete && syncLabel === zh.common.analyzeReady) {
      setSyncLabel(zh.repos.aiAnalysisReady)
    }
  }, [
    loadingPersisted,
    analyzing,
    findings,
    generatedSummary,
    latest,
    syncLabel,
  ])

  useEffect(() => {
    return () => {
      analyzeAbortRef.current?.abort()
    }
  }, [])

  const sessionHasData = hasCachedSession(prId)

  useEffect(() => {
    const isEmptySnapshot =
      findings.length === 0 &&
      latest === null &&
      job === null &&
      !generatedSummary

    if (loadingPersisted && !sessionHasData && isEmptySnapshot) {
      return
    }

    patchSession(prId, {
      findings,
      latest,
      job,
      generatedSummary,
      analysisError,
      syncLabel,
    })
  }, [
    prId,
    findings,
    latest,
    job,
    generatedSummary,
    analysisError,
    syncLabel,
    loadingPersisted,
    sessionHasData,
    patchSession,
  ])

  const diffBudget = useMemo(
    () => buildBoundedDiffContext(diffFiles, PROMPT_BUDGET),
    [diffFiles],
  )
  const diffTotal = useMemo(() => Math.max(diffFiles.length, 1), [diffFiles.length])
  const enrichedDiffFiles = useMemo(
    () => enrichDiffFilesWithFindings(diffFiles, findings),
    [diffFiles, findings],
  )

  const hasFindings = findings.length > 0
  const restoring =
    loadingPersisted &&
    !sessionHasData &&
    !generatedSummary &&
    !latest?.mergeRecommendation &&
    findings.length === 0

  const analysisComplete = isPrAnalysisComplete({
    findings,
    generatedSummary,
    latest,
    analyzing,
    restoring,
  })

  const {
    rules: governanceRules,
    loading: governanceLoading,
    reload: reloadGovernance,
  } = usePullRequestGovernance(prId, analysisComplete)

  const hasAnalysis = analysisComplete
  const analysisPhase = deriveAnalysisPhase({
    scanning,
    summaryStreaming,
    analysisError,
    hasAnalysis,
  })
  const selectedFindingId =
    layout.scrollTarget?.findingId ?? layout.highlightTarget?.findingId ?? null

  const persistGeneratedSummary = useCallback(
    async (content: string, usage: AiUsageMetrics | undefined, signal?: AbortSignal) => {
      const payload = buildAiSummaryPersistPayload({
        content,
        model: settings.model,
        provider: settings.provider,
        usage,
        analysisVersion: pr?.analysisVersion ?? job?.analysisVersion ?? null,
      })
      const saved = await patchPrAiSummary(prId, payload, signal)
      setAiSummary(saved)
      if (saved.usage) {
        setRunUsage(saved.usage)
      }
    },
    [
      prId,
      pr?.analysisVersion,
      job?.analysisVersion,
      settings.model,
      settings.provider,
      setAiSummary,
    ],
  )

  const generateSummary = useCallback(
    async (
      activeFindings: AnalysisFinding[],
      jobSummary: string | undefined,
      governanceContext: GovernanceRule[],
      analysisVersion: string | null | undefined,
      signal: AbortSignal,
    ) => {
      if (!hasApiKey || !pr) return

      setSummaryStreaming(true)
      setGeneratedSummary(undefined)

      try {
        const result = await generateAiReviewSummary({
          pr,
          findings: activeFindings,
          governanceRules: governanceContext,
          diffContext: diffBudget.context,
          diffTruncated: diffBudget.truncated,
          jobSummary,
          analysisVersion,
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          signal,
          onDelta: setGeneratedSummary,
        })

        setGeneratedSummary(result.content)
        setRunUsage(result.usage)

        if (result.validationWarnings.length > 0) {
          setAnalysisError(
            `报告格式未完全通过校验（${result.validationWarnings.join("；")}），已展示最佳可用版本。`,
          )
        }

        if (!signal.aborted && result.content) {
          await persistGeneratedSummary(result.content, result.usage, signal)
        }

        recordUsage({
          prId,
          provider: settings.provider,
          model: settings.model,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          costCny: result.usage.costCny,
          latencyMs: result.usage.latencyMs ?? 0,
        })
      } catch (error) {
        if (isAbortError(error)) {
          return
        }
        const message = error instanceof Error ? error.message : "AI 摘要生成失败"
        setAnalysisError(message)
        if (jobSummary) {
          setGeneratedSummary(jobSummary)
        }
        throw error
      } finally {
        if (shouldApplyResult(signal)) {
          setSummaryStreaming(false)
        }
      }
    },
    [
      hasApiKey,
      pr,
      diffBudget,
      settings.provider,
      settings.model,
      settings.apiKey,
      settings.baseUrl,
      persistGeneratedSummary,
      recordUsage,
      prId,
    ],
  )

  const handleRescan = useCallback(async (options?: { force?: boolean }) => {
    if (analyzing || prLoading || diffLoading || !pr) return

    analyzeAbortRef.current?.abort()
    abortLoad()
    const ac = new AbortController()
    analyzeAbortRef.current = ac

    const force = options?.force ?? true
    setScanning(true)
    setSummaryStreaming(false)
    if (force) {
      setGeneratedSummary(undefined)
    }
    setAnalysisError(null)
    setChunkProgress({ current: 0, total: diffTotal })

    const errors: string[] = []

    try {
      const result = await runAnalysis({
        force,
        signal: ac.signal,
        onProgress: (activeJob) => {
          setJob(activeJob)
          setChunkProgress({
            current: Math.max(activeJob.chunkIndex, 0),
            total: Math.max(activeJob.chunkTotal, diffTotal),
          })
        },
      })

      setJob(result.job)
      setChunkProgress({
        current: result.job.chunkTotal || diffTotal,
        total: Math.max(result.job.chunkTotal, diffTotal),
      })

      if (result.cacheHit) {
        setSyncLabel(zh.analysis.cacheLoaded)
        const analysisVersion = result.analysisVersion ?? pr.analysisVersion ?? null
        if (result.latest?.summary) {
          setGeneratedSummary(result.latest.summary)
        }
        if (
          aiSummary?.content &&
          !isAiSummaryStale(aiSummary, analysisVersion)
        ) {
          setGeneratedSummary(aiSummary.content)
          return
        }
        if (!hasApiKey) {
          setAnalysisError("规则扫描与治理检查已完成。填写 API 密钥后可生成 AI 摘要。")
          return
        }
        if (result.latest?.summary && !analysisVersion) {
          return
        }
      }

      if (!hasApiKey) {
        if (result.latest?.summary) {
          setGeneratedSummary(result.latest.summary)
        }
        setAnalysisError("规则扫描与治理检查已完成。填写 API 密钥后可生成 AI 摘要。")
        return
      }

      try {
        const governanceData = await fetchPullRequestGovernance(pr.id, ac.signal)
        await generateSummary(
          result.findings,
          result.latest?.summary,
          governanceData,
          result.analysisVersion ?? pr.analysisVersion ?? null,
          ac.signal,
        )
      } catch (error) {
        if (!isAbortError(error)) {
          errors.push(error instanceof Error ? error.message : "AI 摘要生成失败")
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        return
      }
      errors.push(formatPrismApiError(error, "规则扫描任务失败"))
    } finally {
      if (shouldApplyResult(ac.signal)) {
        setScanning(false)
        setSummaryStreaming(false)
        void reloadGovernance()
        if (errors.length > 0) {
          setAnalysisError(errors.join("；"))
        }
      }
    }
  }, [
    analyzing,
    prLoading,
    diffLoading,
    pr,
    abortLoad,
    diffTotal,
    runAnalysis,
    setJob,
    hasApiKey,
    generateSummary,
    aiSummary?.content,
    reloadGovernance,
  ])

  handleRescanRef.current = handleRescan

  useEffect(() => {
    if (prLoading || diffLoading || !pr) return
    const pendingPrId = sessionStorage.getItem(PENDING_AUTO_ANALYZE_KEY)
    if (!pendingPrId || pendingPrId !== prId) return
    sessionStorage.removeItem(PENDING_AUTO_ANALYZE_KEY)
    void handleRescanRef.current?.({ force: false })
  }, [prId, prLoading, diffLoading, pr])

  const handleRegenerateSummary = useCallback(async () => {
    if (analyzing || prLoading || diffLoading || !pr) return
    if (!hasFindings && !latest?.summary) {
      void handleRescan()
      return
    }

    analyzeAbortRef.current?.abort()
    abortLoad()
    const ac = new AbortController()
    analyzeAbortRef.current = ac

    setAnalysisError(null)
    setGeneratedSummary(undefined)

    try {
      const governanceData = await fetchPullRequestGovernance(pr.id, ac.signal)
      await generateSummary(
        findings,
        latest?.summary,
        governanceData,
        pr.analysisVersion ?? job?.analysisVersion ?? null,
        ac.signal,
      )
    } catch (error) {
      if (!isAbortError(error)) {
        setAnalysisError(error instanceof Error ? error.message : "AI 摘要生成失败")
      }
    }
  }, [
    analyzing,
    prLoading,
    diffLoading,
    pr,
    hasFindings,
    latest?.summary,
    handleRescan,
    abortLoad,
    findings,
    generateSummary,
    pr?.analysisVersion,
    job?.analysisVersion,
  ])

  const handleAnalyze = hasFindings ? handleRegenerateSummary : handleRescan

  const summaryError = analysisError ?? persistError
  const showPrSkeleton = prLoading && !sessionHasData && !pr
  const showAdoptBanner =
    pr != null &&
    shouldShowAdoptBanner(
      pr,
      pr.repoId ? repos.find((r) => r.id === pr.repoId) : undefined,
    )

  const handleRepoAdopted = useCallback(() => {
    patchLocal({
      isManaged: true,
      managed: true,
      repositoryType: "managed",
    })
    reloadPr()
    void refreshRepos()
    onReviewStatusChanged?.()
  }, [patchLocal, reloadPr, refreshRepos, onReviewStatusChanged])

  const analysisJobRunning =
    scanning || summaryStreaming || job?.status === "running"

  const panelState = resolveAnalysisPanelState({
    analysisComplete,
    analysisJobRunning,
  })

  const runningLabel = resolveRunningLabel({ scanning, summaryStreaming })

  const opinion = useMemo(
    () =>
      buildAiReviewerOpinion({
        findings,
        latest: latest ?? null,
        prTitle: pr?.displayName?.trim() || pr?.title,
        repoLabel: pr?.repo,
        prNumber: pr?.number,
        generatedSummary,
        hasCompletedAnalysis: analysisComplete,
        governanceRules,
      }),
    [findings, latest, pr, generatedSummary, analysisComplete, governanceRules],
  )

  const copilotTask = useMemo(() => {
    if (!pr) return null
    const metricsCache = new Map([
      [pr.id, { branch: pr.sourceBranch, filesChanged: pr.filesChanged }],
    ])
    const ranked = computeInboxItems([pr], {
      settings: readPrioritySettings(),
      metricsCache,
    })
    const enriched = enrichTasksWithOpinion(ranked)
    return enriched[0] ?? null
  }, [pr, generatedSummary, latest, findings])

  if ((prError || !pr) && !sessionHasData && !prLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-risk-high px-4 text-center">
        {prError ?? "合并请求不存在"}
      </div>
    )
  }

  const findingsBuckets = bucketFindingsBySeverity(findings)
  const findingsCounts = {
    critical: findingsBuckets.critical.length,
    warning: findingsBuckets.warning.length,
    other: findingsBuckets.other.length,
  }

  if (showPrSkeleton) {
    return <ReviewPageSkeleton />
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      {pr ? (
        <Header
          prData={pr}
          analyzing={analyzing}
          scanning={scanning}
          hasAnalysis={hasAnalysis}
          hasFindings={hasFindings}
          onAnalyze={handleAnalyze}
          onRescan={hasFindings ? handleRescan : undefined}
          diffLoading={diffLoading}
          prLoading={prLoading}
          analysisPhase={analysisPhase}
          findingsCounts={findingsCounts}
        />
      ) : (
        <div className="flex items-center gap-2 min-h-[44px] px-4 py-2 border-b border-border text-sm text-muted-foreground shrink-0">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在加载 PR 信息…
        </div>
      )}

      <div className="flex flex-1 min-w-0 min-h-0 flex-col md:flex-row overflow-hidden">
        <div className="flex flex-1 min-w-0 flex-col min-h-0">
        {showAdoptBanner ? (
          <div className="shrink-0 px-3 pt-2">
            <AdoptRepoBanner pr={pr} onAdopted={handleRepoAdopted} />
          </div>
        ) : null}
        {diffError ? (
          <p className="shrink-0 px-3 pt-2 text-xs text-risk-high">
            {zh.common.diffLoadFailed}：{diffError}
          </p>
        ) : null}

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
          <DiffViewer
            files={enrichedDiffFiles}
            loading={diffLoading}
            analyzing={scanning}
            chunkProgress={scanning ? chunkProgress : undefined}
            scrollTarget={layout.scrollTarget}
            highlightTarget={layout.highlightTarget}
          />
        </div>

        {pr ? (
          <ReviewFindingsDock
            findings={findings}
            selectedFindingId={selectedFindingId}
            expanded={layout.findingsExpanded}
            onExpandedChange={layout.setFindingsExpanded}
            onSelectFinding={layout.jumpToFinding}
            hasAnalysis={hasAnalysis}
            analyzing={analyzing}
            onAnalyze={handleAnalyze}
            onOpenFullReport={layout.openInsight}
            className="shrink-0 border-t border-border bg-panel/60"
          />
        ) : null}

        {pr && analysisComplete ? (
          <div className="shrink-0 sticky bottom-0 z-40 border-t border-border bg-panel/95 backdrop-blur px-3 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.25)] md:hidden">
            <ReviewCompletionBanner pr={pr} />
          </div>
        ) : null}
        </div>

        {pr && copilotTask ? (
          <ReviewCopilotPanel
            pr={pr}
            panelState={panelState}
            runningLabel={runningLabel}
            opinion={opinion}
            findings={findings}
            taskForActions={copilotTask}
            governanceRules={governanceRules}
            governanceLoading={governanceLoading}
            onOpenFullReport={layout.openInsight}
            className="hidden md:flex"
          />
        ) : null}
      </div>

      {pr && layout.insightOpen ? (
        <ReviewInsightDrawer
          open={layout.insightOpen}
          onClose={layout.closeInsight}
          prId={prId}
          pr={pr}
          opinion={opinion}
          findings={findings}
          latest={latest}
          generatedSummary={generatedSummary}
          scanning={scanning}
          streaming={summaryStreaming}
          model={settings.model}
          jobSummary={latest?.summary}
          hasAnalysis={hasAnalysis}
          restoring={restoring}
          error={summaryError}
          usage={runUsage}
          reviewTimelineKey={reviewTimelineKey}
          onGoToSettings={() => navigate("settings")}
        />
      ) : null}
    </div>
  )
}
