"use client"

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Header } from "@/features/prism/components/header"
import { PROverview } from "@/features/prism/components/pr-overview"
import { AISummary } from "@/features/prism/components/ai-summary"
import { DiffViewer } from "@/features/prism/components/diff-viewer"
import { AIPanel } from "@/features/prism/components/ai-panel"
import { estimateCostCny, useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { usePullRequest } from "@/hooks/use-pull-request"
import { usePullRequestDiff } from "@/hooks/use-pull-request-diff"
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

export function AIReviewView({
  prId,
  onMenuClick,
  aiPanelOpen = true,
  onToggleAIPanel,
}: AIReviewViewProps) {
  const { settings, hasApiKey, recordUsage } = useAISettings()
  const { data: pr, loading: prLoading, error: prError } = usePullRequest(prId)
  const { files: diffFiles, loading: diffLoading, error: diffError } = usePullRequestDiff(prId)

  const [analyzing, setAnalyzing] = useState(false)
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 1 })
  const [generatedSummary, setGeneratedSummary] = useState<string | undefined>()
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const diffTotal = useMemo(() => Math.max(diffFiles.length, 1), [diffFiles.length])

  const handleAnalyze = async () => {
    if (analyzing || !pr) return

    if (!hasApiKey) {
      setAnalysisError("请先在系统设置中填写 API 密钥，再启动真实 AI 分析。")
      return
    }

    setAnalyzing(true)
    setAnalysisError(null)
    setChunkProgress({ current: 0, total: diffTotal })

    try {
      const diffContext = buildDiffContext(diffFiles)

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
                "你是 PRism 的资深代码评审 AI。请用中文输出结构化 PR 评审摘要，重点关注安全、性能、架构、破坏性变更和是否建议合并。输出应简洁、可行动。",
            },
            {
              role: "user",
              content: `请评审这个合并请求。\n\nPR 标题：${pr.title}\n仓库：${pr.repo}\n分支：${pr.sourceBranch} -> ${pr.targetBranch}\n变更规模：${pr.filesChanged} 文件，+${pr.additions} -${pr.deletions}\n\nDiff 摘要：\n${diffContext || "（无 diff 内容）"}`,
            },
          ],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errMsg =
          typeof data?.error === "string"
            ? data.error
            : data?.detail?.error ?? "AI 分析失败"
        throw new Error(errMsg)
      }

      const totalTokens = Number(data?.usage?.totalTokens) || 0
      setGeneratedSummary(data?.content || "模型未返回内容。")
      setChunkProgress({ current: diffTotal, total: diffTotal })

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
      setAnalysisError(error instanceof Error ? error.message : "AI 分析失败")
    } finally {
      setAnalyzing(false)
    }
  }

  if (prLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        加载合并请求…
      </div>
    )
  }

  if (prError || !pr) {
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
          <Header
            prData={pr}
            analyzing={analyzing}
            onAnalyze={handleAnalyze}
            onMenuClick={onMenuClick}
            aiPanelOpen={aiPanelOpen}
            onToggleAIPanel={onToggleAIPanel}
          />

          <div className="p-5 space-y-4">
            <PROverview prData={pr} />
            <AISummary
              streaming={analyzing}
              model={settings.model}
              generatedSummary={generatedSummary}
              error={analysisError}
            />

            {diffError && (
              <p className="text-xs text-risk-high">Diff 加载失败：{diffError}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <h3 className="text-sm font-semibold text-foreground">文件变更</h3>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{pr.filesChanged} 文件</span>
                <span className="text-[oklch(0.62_0.17_148)]">+{pr.additions.toLocaleString()}</span>
                <span className="text-[oklch(0.55_0.22_27)]">-{pr.deletions.toLocaleString()}</span>
              </div>
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
        {aiPanelOpen && <AIPanel analyzing={analyzing} />}
      </div>
    </div>
  )
}
