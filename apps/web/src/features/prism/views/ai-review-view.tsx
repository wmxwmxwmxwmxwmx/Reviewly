"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AnalysisFinding, AiUsageMetrics, ReviewStatus } from "@reviewly/shared"
import { Loader2 } from "lucide-react"
import { Header } from "@/features/prism/components/header"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useAIReviewSession } from "@/features/prism/contexts/ai-review-session-context"
import { AISummary } from "@/features/prism/components/ai-summary"
import { DiffViewer } from "@/features/prism/components/diff-viewer"
import {
  bucketFindingsBySeverity,
  ReviewFindingsDock,
} from "@/features/prism/components/review-findings-dock"
import { ReviewInsightDrawer } from "@/features/prism/components/review-insight-drawer"
import { ReviewDecisionBar } from "@/features/prism/components/review-decision-bar"
import { ReviewPageSkeleton } from "@/features/prism/components/review-page-skeleton"
import { ReviewQuickVerdict } from "@/features/prism/components/review-quick-verdict"
import { enrichDiffFilesWithFindings, scrollTargetFromFinding } from "@/features/prism/lib/map-findings-to-diff"
import { deriveAnalysisPhase, useReviewLayout } from "@/hooks/use-review-layout"
import { estimateCostCnyFromUsage, useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { usePullRequest } from "@/hooks/use-pull-request"
import { usePullRequestDiff } from "@/hooks/use-pull-request-diff"
import { usePrAnalysis } from "@/hooks/use-pr-analysis"
import {
  chatCompletionStream,
  patchPrAiSummary,
} from "@/lib/api/ai-chat"
import { PENDING_AUTO_ANALYZE_KEY } from "@/hooks/use-import-pr-by-url"
import { useRunningTask } from "@/features/prism/contexts/running-tasks-context"
import {
  buildBoundedDiffContext,
  buildFindingsContext,
  PROMPT_BUDGET,
} from "@/lib/ai/prompt-budget"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { formatPrismApiError, PrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"
import { AdoptRepoBanner } from "@/features/prism/components/adopt-repo-banner"
import { ReviewCopilotPanel } from "@/features/prism/components/review-copilot-panel"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { isRepositoryManaged } from "@/lib/repos/is-repository-managed"

interface AIReviewViewProps {
  prId: string
  onReviewStatusChanged?: () => void
}

export function AIReviewView({ prId, onReviewStatusChanged }: AIReviewViewProps) {
  const { navigate } = useNavigation()
  const { refresh: refreshRepos } = useReposStore()
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
    cached.generatedSummary ?? aiSummary?.content,
  )
  const [analysisError, setAnalysisError] = useState<string | null>(
    cached.analysisError ?? null,
  )
  const [reviewTimelineKey, setReviewTimelineKey] = useState(0)
  const [runUsage, setRunUsage] = useState<AiUsageMetrics | undefined>(aiSummary?.usage)
  const layout = useReviewLayout()

  const analyzeAbortRef = useRef<AbortController | null>(null)
  const handleRescanRef = useRef<((options?: { force?: boolean }) => Promise<void>) | null>(null)

  useRunningTask("aiReview", analyzing)

  useEffect(() => {
    setLastReviewedPrId(prId)
  }, [prId, setLastReviewedPrId])

  useEffect(() => {
    abortLoad()
    const controller = new AbortController()
    void loadPersisted(controller.signal).then((result) => {
      if (result?.aiSummary?.content) {
        setGeneratedSummary(result.aiSummary.content)
      }
      if (result?.aiSummary?.usage) {
        setRunUsage(result.aiSummary.usage)
      }
    }).catch(() => {
      /* persistError 已由 hook 记录 */
    })
    return () => controller.abort()
  }, [prId, loadPersisted, abortLoad])

  useEffect(() => {
    if (loadingPersisted || analyzing) return
    const hasPersistedAnalysis =
      findings.length > 0 ||
      Boolean(latest?.summary) ||
      job?.status === "completed"
    if (hasPersistedAnalysis && syncLabel === zh.common.analyzeReady) {
      setSyncLabel(zh.repos.aiAnalysisReady)
    }
  }, [
    loadingPersisted,
    analyzing,
    findings.length,
    latest?.summary,
    job?.status,
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
  const hasAnalysis =
    hasFindings ||
    Boolean(generatedSummary) ||
    Boolean(latest?.summary) ||
    sessionHasData
  const analysisPhase = deriveAnalysisPhase({
    scanning,
    summaryStreaming,
    analysisError,
    hasAnalysis,
  })
  const selectedFindingId =
    layout.scrollTarget?.findingId ?? layout.highlightTarget?.findingId ?? null
  const restoring =
    loadingPersisted &&
    !sessionHasData &&
    !generatedSummary &&
    !latest?.summary &&
    findings.length === 0

  const persistGeneratedSummary = useCallback(
    async (content: string, usage: AiUsageMetrics | undefined, signal?: AbortSignal) => {
      const payload = {
        content,
        analyzedAt: new Date().toISOString(),
        model: settings.model,
        provider: settings.provider,
        ...(usage ? { usage } : {}),
      }
      const saved = await patchPrAiSummary(prId, payload, signal)
      setAiSummary(saved)
      if (saved.usage) {
        setRunUsage(saved.usage)
      }
    },
    [prId, settings.model, settings.provider, setAiSummary],
  )

  const generateSummary = useCallback(
    async (
      activeFindings: AnalysisFinding[],
      jobSummary: string | undefined,
      signal: AbortSignal,
    ) => {
      if (!hasApiKey || !pr) return

      setSummaryStreaming(true)
      setGeneratedSummary(undefined)

      const diffContext = diffBudget.context
      const findingsContext = buildFindingsContext(activeFindings)

      const messages = [
        {
          role: "system" as const,
          content:
            "你是 PRism 的资深代码评审 AI。请用中文输出结构化 PR 评审摘要（Markdown），重点关注安全、性能、架构、破坏性变更和是否建议合并。必须仅基于用户提供的 Diff 与 findings，禁止编造未出现的文件或问题。",
        },
        {
          role: "user" as const,
          content: `请评审这个合并请求。

PR 标题：${pr.title}
仓库：${pr.repo}
分支：${pr.sourceBranch} -> ${pr.targetBranch}
变更规模：${pr.filesChanged} 文件，+${pr.additions} -${pr.deletions}
${diffBudget.truncated ? "\n（Diff 已按上下文预算截断，请基于可见部分评审）\n" : ""}

规则扫描 findings：
${findingsContext}

Diff 摘要：
${diffContext || "（无 diff 内容）"}`,
        },
      ]

      let accumulated = ""
      let promptTokens = 0
      let completionTokens = 0
      let totalTokens = 0
      let latencyMs = 0

      try {
        await chatCompletionStream(
          {
            provider: settings.provider,
            model: settings.model,
            apiKey: settings.apiKey.trim() || undefined,
            messages,
          },
          {
            signal,
            onDelta: (delta) => {
              accumulated += delta
              setGeneratedSummary(accumulated)
            },
            onUsage: (meta) => {
              if (meta.usage) {
                promptTokens = meta.usage.promptTokens
                completionTokens = meta.usage.completionTokens
                totalTokens = meta.usage.totalTokens
              }
              if (typeof meta.latencyMs === "number") {
                latencyMs = meta.latencyMs
              }
            },
            onError: (msg) => {
              throw new Error(msg)
            },
          },
        )

        const finalSummary = accumulated.trim() || jobSummary || "模型未返回内容。"
        setGeneratedSummary(finalSummary)

        const resolvedTotal = totalTokens || promptTokens + completionTokens
        const costCny = estimateCostCnyFromUsage(
          settings.provider,
          settings.model,
          promptTokens,
          completionTokens,
        )
        const usage: AiUsageMetrics = {
          promptTokens,
          completionTokens,
          totalTokens: resolvedTotal,
          costCny,
          latencyMs,
        }
        setRunUsage(usage)

        if (!signal.aborted && finalSummary) {
          await persistGeneratedSummary(finalSummary, usage, signal)
        }

        recordUsage({
          prId,
          provider: settings.provider,
          model: settings.model,
          promptTokens,
          completionTokens,
          totalTokens: resolvedTotal,
          costCny,
          latencyMs,
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
        if (result.latest?.summary) {
          setGeneratedSummary(result.latest.summary)
        }
        if (aiSummary?.content) {
          setGeneratedSummary(aiSummary.content)
          return
        }
        if (!hasApiKey) {
          setAnalysisError("规则扫描与治理检查已完成。填写 API 密钥后可生成 AI 摘要。")
          return
        }
        if (result.latest?.summary) {
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
        await generateSummary(result.findings, result.latest?.summary, ac.signal)
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
      await generateSummary(findings, latest?.summary, ac.signal)
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
  ])

  const handleAnalyze = hasFindings ? handleRegenerateSummary : handleRescan

  const analysisScores = latest
    ? {
        riskScore: latest.riskScore,
        securityScore: latest.securityScore,
        performanceScore: latest.performanceScore,
        maintainabilityScore: latest.maintainabilityScore,
      }
    : undefined

  const summaryError = analysisError ?? persistError
  const showPrSkeleton = prLoading && !sessionHasData && !pr
  const showAdoptBanner = pr != null && !isRepositoryManaged(pr)

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

  const handleCopilotStartReview = useCallback(() => {
    const sorted = [...findings].sort(
      (a, b) =>
        ({ critical: 0, high: 1, medium: 2, low: 3 }[a.severity ?? "low"] ?? 9) -
        ({ critical: 0, high: 1, medium: 2, low: 3 }[b.severity ?? "low"] ?? 9),
    )
    const top = sorted[0]
    if (top) layout.jumpToFinding(scrollTargetFromFinding(top))
  }, [findings, layout])

  if ((prError || !pr) && !sessionHasData && !prLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-risk-high px-4 text-center">
        {prError ?? "合并请求不存在"}
      </div>
    )
  }

  const hasCompletedAnalysis =
    findings.length > 0 ||
    job?.status === "completed" ||
    Boolean(latest?.summary) ||
    Boolean(generatedSummary)

  const fallbackScores = pr
    ? {
        riskScore: analysisScores?.riskScore ?? pr.riskScore,
        securityScore: analysisScores?.securityScore ?? pr.securityScore,
        performanceScore: analysisScores?.performanceScore ?? pr.performanceScore,
        maintainabilityScore:
          analysisScores?.maintainabilityScore ?? pr.maintainabilityScore,
      }
    : undefined

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
          insightOpen={layout.insightOpen}
          onOpenInsight={layout.openInsight}
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
          <div className="shrink-0 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x md:divide-border bg-panel/60">
            <ReviewFindingsDock
              findings={findings}
              selectedFindingId={selectedFindingId}
              expanded={layout.findingsExpanded}
              onExpandedChange={layout.setFindingsExpanded}
              onSelectFinding={layout.jumpToFinding}
              hasAnalysis={hasAnalysis}
              analyzing={analyzing}
              onAnalyze={handleAnalyze}
            />
            <div className="px-3 py-2 border-t md:border-t-0 border-border min-w-0">
              <AISummary
                variant="teaser"
                scanning={scanning}
                streaming={summaryStreaming}
                model={settings.model}
                generatedSummary={generatedSummary}
                jobSummary={latest?.summary}
                hasAnalysis={hasAnalysis}
                restoring={restoring}
                error={summaryError}
                onGoToSettings={() => navigate("settings")}
                onOpenInsight={layout.openInsight}
              />
            </div>
          </div>
        ) : null}

        {pr ? (
          <div className="group relative shrink-0 sticky bottom-0 z-40 border-t border-border bg-panel/95 backdrop-blur px-3 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
            <div className="hidden md:block pointer-events-none absolute bottom-full left-3 right-3 mb-2 opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
              <ReviewQuickVerdict
                findings={findings}
                latest={latest}
                prTitle={pr.title}
                repoLabel={pr.repo}
                prNumber={pr.number}
                aiSummary={generatedSummary}
                hasCompletedAnalysis={hasCompletedAnalysis}
                fallbackScores={fallbackScores}
              />
            </div>
            <ReviewDecisionBar
              prId={prId}
              reviewStatus={pr.reviewStatus ?? "OPEN"}
              layout="sticky"
              compact
              onUpdated={() => {
                setReviewTimelineKey((k) => k + 1)
                reloadPr()
              }}
              onStatusChange={(next: ReviewStatus) => {
                patchLocal({ reviewStatus: next })
                onReviewStatusChanged?.()
              }}
            />
          </div>
        ) : null}
        </div>

        {pr ? (
          <ReviewCopilotPanel
            pr={pr}
            findings={findings}
            aiSummary={generatedSummary}
            onStartReview={handleCopilotStartReview}
            onReviewStatusChanged={onReviewStatusChanged}
            reloadPr={reloadPr}
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
          findings={findings}
          latest={latest}
          generatedSummary={generatedSummary}
          hasCompletedAnalysis={hasCompletedAnalysis}
          fallbackScores={fallbackScores}
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
