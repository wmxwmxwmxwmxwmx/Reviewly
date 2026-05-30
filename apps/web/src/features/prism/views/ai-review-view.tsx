"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AnalysisFinding, AiUsageMetrics, ReviewStatus } from "@reviewly/shared"
import { Loader2 } from "lucide-react"
import { Header } from "@/features/prism/components/header"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useAIReviewSession } from "@/features/prism/contexts/ai-review-session-context"
import { DiffViewer } from "@/features/prism/components/diff-viewer"
import { ReviewFileRail } from "@/features/prism/components/review-file-rail"
import { ReviewInsightPanel } from "@/features/prism/components/review-insight-panel"
import { ReviewPageSkeleton } from "@/features/prism/components/review-page-skeleton"
import { enrichDiffFilesWithFindings } from "@/features/prism/lib/map-findings-to-diff"
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

interface AIReviewViewProps {
  prId: string
  onReviewStatusChanged?: () => void
}

export function AIReviewView({ prId, onReviewStatusChanged }: AIReviewViewProps) {
  const { navigate } = useNavigation()
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
  const isExternalRepo =
    pr?.repositoryType === "external" ||
    pr?.managed === false ||
    pr?.sourceType === "external"

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

  const insightPanelProps = pr
    ? {
        prId,
        pr,
        reviewStatus: pr.reviewStatus ?? "OPEN",
        findings,
        latest,
        generatedSummary,
        hasCompletedAnalysis,
        fallbackScores: {
          riskScore: analysisScores?.riskScore ?? pr.riskScore,
          securityScore: analysisScores?.securityScore ?? pr.securityScore,
          performanceScore: analysisScores?.performanceScore ?? pr.performanceScore,
          maintainabilityScore:
            analysisScores?.maintainabilityScore ?? pr.maintainabilityScore,
        },
        scanning,
        streaming: summaryStreaming,
        model: settings.model,
        jobSummary: latest?.summary,
        hasAnalysis,
        restoring,
        error: summaryError,
        usage: runUsage,
        reviewTimelineKey,
        onGoToSettings: () => navigate("settings"),
        onUpdated: () => {
          setReviewTimelineKey((k) => k + 1)
          reloadPr()
        },
        onStatusChange: (next: ReviewStatus) => {
          patchLocal({ reviewStatus: next })
          onReviewStatusChanged?.()
        },
      }
    : null

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
          syncLabel={syncLabel}
          diffLoading={diffLoading}
          prLoading={prLoading}
          analysisPhase={analysisPhase}
          chunkProgress={scanning ? chunkProgress : undefined}
          aiPanelOpen={layout.insightOpen}
          onToggleAIPanel={layout.toggleInsight}
        />
      ) : (
        <div className="flex items-center gap-2 min-h-[52px] px-5 py-2.5 border-b border-border text-sm text-muted-foreground shrink-0">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在加载 PR 信息…
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">
        {pr ? (
          <ReviewFileRail
            pr={pr}
            findings={findings}
            reviewStatus={pr.reviewStatus ?? "OPEN"}
            selectedFindingId={selectedFindingId}
            analyzing={analyzing}
            hasAnalysis={hasAnalysis}
            onSelectFinding={layout.jumpToFinding}
            onAnalyze={handleAnalyze}
            open={layout.leftRailOpen}
            onToggleOpen={() => layout.setLeftRailOpen((v) => !v)}
          />
        ) : null}

        <div className="flex flex-1 min-w-0 flex-col min-h-0">
          {isExternalRepo && pr ? (
            <div className="shrink-0 px-3 pt-2">
              <AdoptRepoBanner pr={pr} />
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
        </div>

        {insightPanelProps && layout.insightOpen ? (
          <ReviewInsightPanel
            {...insightPanelProps}
            className="hidden xl:flex"
          />
        ) : null}

        {insightPanelProps && layout.insightOpen ? (
          <div className="fixed inset-0 z-40 flex xl:hidden">
            <button
              type="button"
              className="flex-1 bg-black/60"
              aria-label="关闭洞察面板"
              onClick={() => layout.setInsightOpen(false)}
            />
            <ReviewInsightPanel
              {...insightPanelProps}
              onClose={() => layout.setInsightOpen(false)}
            />
          </div>
        ) : null}

        {pr && findings.length > 0 ? (
          <div className="lg:hidden fixed bottom-4 left-4 right-4 z-30 flex gap-2 justify-center pointer-events-none">
            <button
              type="button"
              className="pointer-events-auto px-3 py-2 rounded-full border border-border bg-panel/95 backdrop-blur text-xs font-medium shadow-lg"
              onClick={() => layout.setMobileSheet("findings")}
            >
              问题 {findings.length}
            </button>
            <button
              type="button"
              className="pointer-events-auto px-3 py-2 rounded-full border border-ai-blue/40 bg-ai-blue/15 text-ai-blue text-xs font-medium shadow-lg"
              onClick={() => layout.setInsightOpen(true)}
            >
              洞察
            </button>
          </div>
        ) : null}

        {pr && layout.mobileSheet === "findings" ? (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <button
              type="button"
              className="flex-1 bg-black/60"
              aria-label="关闭问题列表"
              onClick={() => layout.setMobileSheet(null)}
            />
            <ReviewFileRail
              pr={pr}
              findings={findings}
              reviewStatus={pr.reviewStatus ?? "OPEN"}
              selectedFindingId={selectedFindingId}
              analyzing={analyzing}
              hasAnalysis={hasAnalysis}
              onSelectFinding={layout.jumpToFinding}
              onAnalyze={handleAnalyze}
              open
              overlay
              className="w-[min(100%,300px)] shadow-2xl"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
