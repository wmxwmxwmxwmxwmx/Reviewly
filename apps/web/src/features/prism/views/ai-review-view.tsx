"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { importPullRequestByUrl } from "@/lib/api/pull-requests"
import { PrismApiError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

interface AIReviewViewProps {
  prId: string
  onMenuClick?: () => void
  aiPanelOpen?: boolean
  onToggleAIPanel?: () => void
}

function buildDiffContext(files: ReturnType<typeof usePullRequestDiff>["files"]) {
  return files
    .slice(0, 4)
    .map((file) => {
      const lines = file.chunks.flatMap((chunk) => [
        chunk.header,
        ...chunk.lines.map((line) =>
          `${line.type === "add" ? "+" : line.type === "delete" ? "-" : " "}${line.content}`,
        ),
      ])
      return `文件：${file.path}\n语言：${file.language}\n风险等级：${file.riskLevel}\n${lines.join("\n")}`
    })
    .join("\n\n---\n\n")
}

function buildFindingsContext(findings: AnalysisFinding[]) {
  if (findings.length === 0) {
    return "（规则扫描未发现结构化风险项，请仅依据 Diff 做评审。）"
  }

  return findings
    .map(
      (f) =>
        `- [${f.severity}] ${f.file}:${f.line} ${f.title}\n  ${f.description}\n  修复建议：${f.fixSuggestion}`,
    )
    .join("\n")
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
    loadingPersisted,
    persistError,
    loadPersisted,
    runAnalysis,
    setJob,
  } = usePrAnalysis(prId, {
    findings: cached.findings,
    latest: cached.latest,
    job: cached.job,
  })

  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [syncLabel, setSyncLabel] = useState(cached.syncLabel ?? "同步完成")
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 1 })
  const [generatedSummary, setGeneratedSummary] = useState<string | undefined>(
    cached.generatedSummary,
  )
  const [analysisError, setAnalysisError] = useState<string | null>(
    cached.analysisError ?? null,
  )
  const [activePanelTab, setActivePanelTab] = useState<AIReviewPanelTab>(
    cached.activePanelTab ?? "risks",
  )

  useEffect(() => {
    setLastReviewedPrId(prId)
  }, [prId, setLastReviewedPrId])

  useEffect(() => {
    const controller = new AbortController()
    void loadPersisted(controller.signal).catch(() => {
      /* persistError 已由 hook 记录 */
    })
    return () => controller.abort()
  }, [prId, loadPersisted])

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
      try {
        const result = await importPullRequestByUrl(url)
        if (result.source === "cache") {
          setSyncLabel("已加载")
        } else if (result.source === "github_app") {
          setSyncLabel("已从 GitHub 同步")
        } else {
          setSyncLabel("已从 GitHub 导入")
        }
        if (result.prId !== prId) {
          navigate("ai-review", { prId: result.prId })
        }
      } catch (error) {
        const message =
          error instanceof PrismApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "无法加载 PR"
        setImportError(message)
      } finally {
        setImporting(false)
      }
    },
    [navigate, prId],
  )

  const diffTotal = useMemo(() => Math.max(diffFiles.length, 1), [diffFiles.length])
  const hasAnalysis =
    findings.length > 0 ||
    Boolean(generatedSummary) ||
    Boolean(latest?.summary) ||
    sessionHasData
  const restoring =
    loadingPersisted &&
    !sessionHasData &&
    !generatedSummary &&
    !latest?.summary &&
    findings.length === 0

  const handleAnalyze = async () => {
    if (analyzing || !pr) return

    if (!hasApiKey) {
      setAnalysisError("请先在系统设置中填写 API 密钥，再启动真实 AI 分析。")
      return
    }

    setAnalyzing(true)
    setAnalysisError(null)
    setChunkProgress({ current: 0, total: diffTotal })

    let jobFindings: AnalysisFinding[] = []
    let jobSummary: string | undefined
    const errors: string[] = []

    try {
      const result = await runAnalysis({
        onProgress: (activeJob) => {
          setJob(activeJob)
          setChunkProgress({
            current: Math.max(activeJob.chunkIndex, 0),
            total: Math.max(activeJob.chunkTotal, diffTotal),
          })
        },
      })
      jobFindings = result.findings
      jobSummary = result.latest.summary
      setJob(result.job)
      setChunkProgress({
        current: result.job.chunkTotal || diffTotal,
        total: Math.max(result.job.chunkTotal, diffTotal),
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "规则扫描任务失败")
    }

    let nextGeneratedSummary = generatedSummary

    try {
      const diffContext = buildDiffContext(diffFiles)
      const findingsContext = buildFindingsContext(jobFindings)

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey,
          messages: [
            {
              role: "system",
              content:
                "你是 PRism 的资深代码评审 AI。请用中文输出结构化 PR 评审摘要（Markdown），重点关注安全、性能、架构、破坏性变更和是否建议合并。必须仅基于用户提供的 Diff 与 findings，禁止编造未出现的文件或问题。",
            },
            {
              role: "user",
              content: `请评审这个合并请求。

PR 标题：${pr.title}
仓库：${pr.repo}
分支：${pr.sourceBranch} -> ${pr.targetBranch}
变更规模：${pr.filesChanged} 文件，+${pr.additions} -${pr.deletions}

规则扫描 findings：
${findingsContext}

Diff 摘要：
${diffContext || "（无 diff 内容）"}`,
            },
          ],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errMsg =
          typeof data?.error === "string"
            ? data.error
            : data?.detail?.error ?? "AI 摘要生成失败"
        throw new Error(errMsg)
      }

      const totalTokens = Number(data?.usage?.totalTokens) || 0
      nextGeneratedSummary = data?.content || jobSummary || "模型未返回内容。"
      setGeneratedSummary(nextGeneratedSummary)

      recordUsage({
        provider: settings.provider,
        model: settings.model,
        promptTokens: Number(data?.usage?.promptTokens) || 0,
        completionTokens: Number(data?.usage?.completionTokens) || 0,
        totalTokens,
        costCny: estimateCostCny(settings.provider, totalTokens),
        latencyMs: Number(data?.latencyMs) || 0,
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "AI 摘要生成失败")
      if (jobSummary) {
        nextGeneratedSummary = jobSummary
        setGeneratedSummary(jobSummary)
      }
    }

    if (errors.length > 0) {
      setAnalysisError(errors.join("；"))
    }

    setAnalyzing(false)
  }

  const analysisScores = latest
    ? {
        riskScore: latest.riskScore,
        securityScore: latest.securityScore,
        performanceScore: latest.performanceScore,
        maintainabilityScore: latest.maintainabilityScore,
      }
    : undefined

  const summaryError = analysisError ?? persistError
  const showFullPagePrLoading = prLoading && !sessionHasData

  if (showFullPagePrLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        加载合并请求…
      </div>
    )
  }

  if ((prError || !pr) && !sessionHasData) {
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
              hasAnalysis={hasAnalysis}
              onAnalyze={handleAnalyze}
              onImportUrl={handleImportUrl}
              importing={importing}
              importError={importError}
              syncLabel={syncLabel}
              onMenuClick={onMenuClick}
              aiPanelOpen={aiPanelOpen}
              onToggleAIPanel={onToggleAIPanel}
            />
          ) : (
            <div className="flex items-center gap-2 h-[68px] px-5 border-b border-border text-sm text-muted-foreground shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在加载 PR 信息…
            </div>
          )}

          <div className="p-5 space-y-4">
            {pr ? (
              <PROverview prData={pr} analysisScores={analysisScores} />
            ) : prError ? (
              <p className="text-xs text-risk-high">{prError}</p>
            ) : null}

            <AISummary
              streaming={analyzing}
              model={settings.model}
              generatedSummary={generatedSummary}
              jobSummary={latest?.summary}
              hasAnalysis={hasAnalysis}
              restoring={restoring}
              error={summaryError}
              onGoToSettings={() => navigate("settings")}
            />

            {diffError && (
              <p className="text-xs text-risk-high">Diff 加载失败：{diffError}</p>
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
              analyzing={analyzing}
              chunkProgress={analyzing ? chunkProgress : undefined}
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
            analyzing={analyzing}
            findings={findings}
            job={job ?? undefined}
            mergeRecommendation={latest?.mergeRecommendation}
            filesChanged={pr?.filesChanged ?? 0}
            activeTab={activePanelTab}
            onActiveTabChange={setActivePanelTab}
          />
        )}
      </div>
    </div>
  )
}
