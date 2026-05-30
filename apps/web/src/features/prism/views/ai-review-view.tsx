"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AnalysisFinding } from "@reviewly/shared"
import { Loader2 } from "lucide-react"
import { Header } from "@/features/prism/components/header"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import {
  useAIReviewSession,
  type AIReviewPanelTab,
} from "@/features/prism/contexts/ai-review-session-context"
import { PROverview } from "@/features/prism/components/pr-overview"
import { AISummary } from "@/features/prism/components/ai-summary"
import { DiffViewer } from "@/features/prism/components/diff-viewer"
import { AIPanel } from "@/features/prism/components/ai-panel"
import { estimateCostCny, useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { usePullRequest } from "@/hooks/use-pull-request"
import { usePullRequestDiff } from "@/hooks/use-pull-request-diff"
import { usePrAnalysis } from "@/hooks/use-pr-analysis"
import {
  chatCompletionStream,
  patchPrAiSummary,
} from "@/lib/api/ai-chat"
import { importPullRequestByUrl } from "@/lib/api/pull-requests"
import {
  buildBoundedDiffContext,
  buildFindingsContext,
  PROMPT_BUDGET,
} from "@/lib/ai/prompt-budget"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { PrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

const PENDING_AUTO_ANALYZE_KEY = "prism:pending-auto-analyze"

interface AIReviewViewProps {
  prId: string
  onMenuClick?: () => void
  aiPanelOpen?: boolean
  onToggleAIPanel?: () => void
}

export function AIReviewView({
  prId,
  onMenuClick,
  aiPanelOpen = true,
  onToggleAIPanel,
}: AIReviewViewProps) {
  const { navigate } = useNavigation()
  const { settings, hasApiKey, recordUsage } = useAISettings()
  const {
    getSession,
    patchSession,
    hasCachedSession,
    setLastReviewedPrId,
  } = useAIReviewSession()

  const cached = getSession(prId)
  const { data: pr, loading: prLoading, error: prError } = usePullRequest(prId)
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
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [syncLabel, setSyncLabel] = useState(cached.syncLabel ?? zh.common.analyzeReady)
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 1 })
  const [generatedSummary, setGeneratedSummary] = useState<string | undefined>(
    cached.generatedSummary ?? aiSummary?.content,
  )
  const [analysisError, setAnalysisError] = useState<string | null>(
    cached.analysisError ?? null,
  )
  const [activePanelTab, setActivePanelTab] = useState<AIReviewPanelTab>(
    cached.activePanelTab ?? "risks",
  )
  const [governanceRefreshKey, setGovernanceRefreshKey] = useState(0)

  const analyzeAbortRef = useRef<AbortController | null>(null)
  const handleRescanRef = useRef<(() => Promise<void>) | null>(null)

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
    }).catch(() => {
      /* persistError 已由 hook 记录 */
    })
    return () => controller.abort()
  }, [prId, loadPersisted, abortLoad])

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
      activePanelTab,
    })
  }, [
    prId,
    findings,
    latest,
    job,
    generatedSummary,
    analysisError,
    syncLabel,
    activePanelTab,
    loadingPersisted,
    sessionHasData,
    patchSession,
  ])

  const handleImportUrl = useCallback(
    async (url: string) => {
      setImporting(true)
      setImportError(null)
      setAnalysisError(null)
      setSyncLabel(zh.common.importingPrHint)
      try {
        const result = await importPullRequestByUrl(url)
        if (result.source === "cache") {
          setSyncLabel(zh.common.loaded)
        } else if (result.source === "github_app") {
          setSyncLabel(zh.common.syncedFromGithub)
        } else {
          setSyncLabel(zh.common.importedFromGithub)
        }
        if (result.prId !== prId) {
          sessionStorage.setItem(PENDING_AUTO_ANALYZE_KEY, result.prId)
          navigate("ai-review", { prId: result.prId })
        } else {
          void handleRescanRef.current?.()
        }
      } catch (error) {
        const message =
          error instanceof PrismApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : zh.common.importFailed
        setImportError(message)
      } finally {
        setImporting(false)
      }
    },
    [navigate, prId],
  )

  const diffBudget = useMemo(
    () => buildBoundedDiffContext(diffFiles, PROMPT_BUDGET),
    [diffFiles],
  )
  const diffTotal = useMemo(() => Math.max(diffFiles.length, 1), [diffFiles.length])
  const approxContextChars = diffBudget.charCount

  const hasFindings = findings.length > 0
  const hasAnalysis =
    hasFindings ||
    Boolean(generatedSummary) ||
    Boolean(latest?.summary) ||
    sessionHasData
  const restoring =
    loadingPersisted &&
    !sessionHasData &&
    !generatedSummary &&
    !latest?.summary &&
    findings.length === 0

  const persistGeneratedSummary = useCallback(
    async (content: string, signal?: AbortSignal) => {
      const payload = {
        content,
        analyzedAt: new Date().toISOString(),
        model: settings.model,
        provider: settings.provider,
      }
      const saved = await patchPrAiSummary(prId, payload, signal)
      setAiSummary(saved)
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
            onError: (msg) => {
              throw new Error(msg)
            },
          },
        )

        const finalSummary = accumulated.trim() || jobSummary || "模型未返回内容。"
        setGeneratedSummary(finalSummary)

        if (!signal.aborted && finalSummary) {
          await persistGeneratedSummary(finalSummary, signal)
        }

        recordUsage({
          provider: settings.provider,
          model: settings.model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: Math.ceil(finalSummary.length / 4),
          costCny: estimateCostCny(settings.provider, Math.ceil(finalSummary.length / 4)),
          latencyMs: 0,
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
    ],
  )

  const handleRescan = useCallback(async () => {
    if (analyzing || prLoading || diffLoading || !pr) return

    analyzeAbortRef.current?.abort()
    abortLoad()
    const ac = new AbortController()
    analyzeAbortRef.current = ac

    setScanning(true)
    setSummaryStreaming(false)
    setGeneratedSummary(undefined)
    setAnalysisError(null)
    setChunkProgress({ current: 0, total: diffTotal })

    const errors: string[] = []

    try {
      const result = await runAnalysis({
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

      setGovernanceRefreshKey((k) => k + 1)

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
      errors.push(error instanceof Error ? error.message : "规则扫描任务失败")
    } finally {
      if (shouldApplyResult(ac.signal)) {
        setScanning(false)
        setSummaryStreaming(false)
        if (errors.length > 0) {
          setAnalysisError(errors.join("；"))
        }
        setGovernanceRefreshKey((k) => k + 1)
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
  ])

  handleRescanRef.current = handleRescan

  useEffect(() => {
    if (prLoading || diffLoading || !pr || importing) return
    const pendingPrId = sessionStorage.getItem(PENDING_AUTO_ANALYZE_KEY)
    if (!pendingPrId || pendingPrId !== prId) return
    sessionStorage.removeItem(PENDING_AUTO_ANALYZE_KEY)
    void handleRescanRef.current?.()
  }, [prId, prLoading, diffLoading, pr, importing])

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
  const isExternalRepo = pr?.sourceType === "external"

  if ((prError || !pr) && !sessionHasData && !prLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-risk-high px-4 text-center">
        {prError ?? "合并请求不存在"}
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {pr ? (
            <Header
              prData={pr}
              analyzing={analyzing}
              scanning={scanning}
              hasAnalysis={hasAnalysis}
              hasFindings={hasFindings}
              onAnalyze={handleAnalyze}
              onRescan={hasFindings ? handleRescan : undefined}
              onImportUrl={handleImportUrl}
              importing={importing}
              importError={importError}
              syncLabel={syncLabel}
              diffLoading={diffLoading}
              prLoading={prLoading}
              onMenuClick={onMenuClick}
              aiPanelOpen={aiPanelOpen}
              onToggleAIPanel={onToggleAIPanel}
            />
          ) : showPrSkeleton ? (
            <div className="flex items-center gap-3 h-[68px] px-5 border-b border-border shrink-0">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 h-[68px] px-5 border-b border-border text-sm text-muted-foreground shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在加载 PR 信息…
            </div>
          )}

          {isExternalRepo ? (
            <div className="mx-5 mt-3 px-3 py-2 rounded-md border border-risk-medium/30 bg-risk-medium/10 text-xs text-risk-medium leading-relaxed">
              {zh.common.externalRepoReviewHint}
            </div>
          ) : null}

          <div className="p-5 space-y-4">
            {pr ? (
              <PROverview prData={pr} analysisScores={analysisScores} />
            ) : prError ? (
              <p className="text-xs text-risk-high">{prError}</p>
            ) : null}

            <AISummary
              scanning={scanning}
              streaming={summaryStreaming}
              model={settings.model}
              generatedSummary={generatedSummary}
              jobSummary={latest?.summary}
              hasAnalysis={hasAnalysis}
              restoring={restoring}
              error={summaryError}
              onGoToSettings={() => navigate("settings")}
            />

            {diffError && (
              <p className="text-xs text-risk-high">
                {zh.common.diffLoadFailed}：{diffError}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <h3 className="text-sm font-semibold text-foreground">文件变更</h3>
              {pr && (
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{pr.filesChanged} 文件</span>
                  <span className="text-[oklch(0.62_0.17_148)]">+{pr.additions.toLocaleString()}</span>
                  <span className="text-[oklch(0.55_0.22_27)]">-{pr.deletions.toLocaleString()}</span>
                </div>
              )}
            </div>

            <DiffViewer
              files={diffFiles}
              loading={diffLoading}
              analyzing={scanning}
              chunkProgress={scanning ? chunkProgress : undefined}
            />
          </div>
        </main>
      </div>

      <div
        className={cn(
          "shrink-0 transition-all duration-200",
          aiPanelOpen ? "w-[390px]" : "w-0 overflow-hidden",
          "max-xl:fixed max-xl:right-0 max-xl:top-0 max-xl:h-full max-xl:z-40 max-xl:shadow-2xl",
          !aiPanelOpen && "max-xl:w-0 max-xl:overflow-hidden",
        )}
      >
        {aiPanelOpen && (
          <AIPanel
            prId={prId}
            governanceRefreshKey={governanceRefreshKey}
            analyzing={analyzing}
            findings={findings}
            job={job ?? undefined}
            mergeRecommendation={latest?.mergeRecommendation}
            filesChanged={pr?.filesChanged ?? 0}
            approxContextChars={approxContextChars}
            activeTab={activePanelTab}
            onActiveTabChange={setActivePanelTab}
          />
        )}
      </div>
    </div>
  )
}
