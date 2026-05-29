"use client"

import { useState } from "react"
import { Header } from "@/features/prism/components/header"
import { PROverview } from "@/features/prism/components/pr-overview"
import { AISummary } from "@/features/prism/components/ai-summary"
import { DiffViewer } from "@/features/prism/components/diff-viewer"
import { AIPanel } from "@/features/prism/components/ai-panel"
import { estimateCostCny, useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { mockDiffFiles, mockPRData } from "@/features/prism/data/mock-data"
import { cn } from "@/lib/utils"

interface AIReviewViewProps {
  onMenuClick?: () => void
  aiPanelOpen?: boolean
  onToggleAIPanel?: () => void
}

export function AIReviewView({
  onMenuClick,
  aiPanelOpen = true,
  onToggleAIPanel,
}: AIReviewViewProps) {
  const { settings, hasApiKey, recordUsage } = useAISettings()
  const [analyzing, setAnalyzing] = useState(false)
  const [chunkProgress, setChunkProgress] = useState({ current: 48, total: 48 })
  const [generatedSummary, setGeneratedSummary] = useState<string | undefined>()
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (analyzing) return

    if (!hasApiKey) {
      setAnalysisError("请先在系统设置中填写 API 密钥，再启动真实 AI 分析。")
      return
    }

    setAnalyzing(true)
    setAnalysisError(null)
    setChunkProgress({ current: 0, total: mockDiffFiles.length })

    try {
      const diffContext = mockDiffFiles.slice(0, 4).map((file) => {
        const lines = file.chunks.flatMap((chunk) => [
          chunk.header,
          ...chunk.lines.map((line) => `${line.type === "add" ? "+" : line.type === "delete" ? "-" : " "}${line.content}`),
        ])

        return `文件：${file.path}\n语言：${file.language}\n风险等级：${file.riskLevel}\n${lines.join("\n")}`
      }).join("\n\n---\n\n")

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
              content: "你是 PRism 的资深代码评审 AI。请用中文输出结构化 PR 评审摘要，重点关注安全、性能、架构、破坏性变更和是否建议合并。输出应简洁、可行动。",
            },
            {
              role: "user",
              content: `请评审这个合并请求。\n\nPR 标题：${mockPRData.title}\n仓库：${mockPRData.repo}\n分支：${mockPRData.sourceBranch} -> ${mockPRData.targetBranch}\n变更规模：${mockPRData.filesChanged} 文件，+${mockPRData.additions} -${mockPRData.deletions}\n\nDiff 摘要：\n${diffContext}`,
            },
          ],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error ?? "AI 分析失败")
      }

      const totalTokens = Number(data?.usage?.totalTokens) || 0
      setGeneratedSummary(data?.content || "模型未返回内容。")
      setChunkProgress({ current: mockDiffFiles.length, total: mockDiffFiles.length })

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

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Header
            prData={mockPRData}
            analyzing={analyzing}
            onAnalyze={handleAnalyze}
            onMenuClick={onMenuClick}
            aiPanelOpen={aiPanelOpen}
            onToggleAIPanel={onToggleAIPanel}
          />

          <div className="p-5 space-y-4">
            <PROverview prData={mockPRData} />
            <AISummary
              streaming={analyzing}
              model={settings.model}
              generatedSummary={generatedSummary}
              error={analysisError}
            />

            <div className="flex items-center justify-between pt-1">
              <h3 className="text-sm font-semibold text-foreground">文件变更</h3>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{mockPRData.filesChanged} 文件</span>
                <span className="text-[oklch(0.62_0.17_148)]">+{mockPRData.additions.toLocaleString()}</span>
                <span className="text-[oklch(0.55_0.22_27)]">-{mockPRData.deletions.toLocaleString()}</span>
              </div>
            </div>

            <DiffViewer
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
          !aiPanelOpen && "max-xl:w-0 max-xl:overflow-hidden"
        )}
      >
        {aiPanelOpen && <AIPanel analyzing={analyzing} />}
      </div>
    </div>
  )
}
