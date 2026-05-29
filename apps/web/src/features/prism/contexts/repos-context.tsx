"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import { useAISettings, estimateCostCny } from "@/features/prism/contexts/ai-settings-context"
import { PrismApiError } from "@/lib/api/client"
import {
  fetchRepoAnalyzeContext,
  fetchRepos,
  syncRepos,
} from "@/lib/api/repos"
import type { Repository } from "@reviewly/shared"

interface ReposContextValue {
  repos: Repository[]
  loading: boolean
  syncing: boolean
  error: string | null
  syncError: string | null
  analyzingRepoId: string | null
  analyzedRepoId: string | null
  analysisText: string
  analysisError: string | null
  refresh: () => Promise<void>
  sync: () => Promise<void>
  analyzeRepository: (repoId: string) => Promise<void>
  clearAnalysis: () => void
}

const ReposContext = createContext<ReposContextValue | null>(null)

function buildAnalyzePrompt(
  repo: Repository,
  findings: { title: string; severity: string; file: string; line: number; description?: string }[],
  readme: string,
) {
  const findingsBlock =
    findings.length > 0
      ? findings
          .map(
            (f) =>
              `- [${f.severity}] ${f.file}:${f.line} ${f.title}\n  ${f.description ?? ""}`,
          )
          .join("\n")
      : "（暂无 PR 分析 findings）"

  return `请分析以下 GitHub 仓库，用中文 Markdown 输出，必须包含四个二级标题：

## 项目复杂度分析
## 技术栈分析
## 风险模块推测
## 可维护性分析

仓库：${repo.fullName}
默认分支：${repo.defaultBranch}
开放 PR 数：${repo.openPrCount}
健康度：${repo.healthScore}

最近 PR Findings：
${findingsBlock}

README（节选）：
${readme || "（无法获取 README）"}`
}

export function ReposProvider({ children }: { children: ReactNode }) {
  const { settings, hasApiKey, recordUsage } = useAISettings()
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [analyzingRepoId, setAnalyzingRepoId] = useState<string | null>(null)
  const [analyzedRepoId, setAnalyzedRepoId] = useState<string | null>(null)
  const [analysisText, setAnalysisText] = useState("")
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRepos()
      setRepos(data)
    } catch (e: unknown) {
      setError(e instanceof PrismApiError ? e.message : "加载仓库失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const sync = useCallback(async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      await syncRepos()
      await refresh()
    } catch (e: unknown) {
      setSyncError(e instanceof PrismApiError ? e.message : "同步失败")
    } finally {
      setSyncing(false)
    }
  }, [refresh])

  const clearAnalysis = useCallback(() => {
    setAnalysisText("")
    setAnalysisError(null)
    setAnalyzingRepoId(null)
    setAnalyzedRepoId(null)
  }, [])

  const analyzeRepository = useCallback(
    async (repoId: string) => {
      if (!hasApiKey) {
        setAnalysisError("请先在系统设置中填写 API 密钥。")
        setAnalyzedRepoId(repoId)
        return
      }

      setAnalyzingRepoId(repoId)
      setAnalysisText("")
      setAnalysisError(null)

      try {
        const ctx = await fetchRepoAnalyzeContext(repoId)
        const prompt = buildAnalyzePrompt(
          ctx.repository,
          ctx.recentFindings,
          ctx.readme,
        )

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
                  "你是资深架构师与代码评审专家。仅基于用户提供的仓库元数据、findings 与 README 分析，禁止编造未出现的文件或技术栈。",
              },
              { role: "user", content: prompt },
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

        setAnalysisText(data?.content || "模型未返回内容。")
        setAnalyzedRepoId(repoId)

        const totalTokens = Number(data?.usage?.totalTokens) || 0
        recordUsage({
          provider: settings.provider,
          model: settings.model,
          promptTokens: Number(data?.usage?.promptTokens) || 0,
          completionTokens: Number(data?.usage?.completionTokens) || 0,
          totalTokens,
          costCny: estimateCostCny(settings.provider, totalTokens),
          latencyMs: Number(data?.latencyMs) || 0,
        })
      } catch (e: unknown) {
        setAnalysisError(e instanceof Error ? e.message : "AI 分析失败")
      } finally {
        setAnalyzingRepoId(null)
      }
    },
    [hasApiKey, settings, recordUsage],
  )

  return (
    <ReposContext.Provider
      value={{
        repos,
        loading,
        syncing,
        error,
        syncError,
        analyzingRepoId,
        analyzedRepoId,
        analysisText,
        analysisError,
        refresh,
        sync,
        analyzeRepository,
        clearAnalysis,
      }}
    >
      {children}
    </ReposContext.Provider>
  )
}

export function useReposStore() {
  const ctx = useContext(ReposContext)
  if (!ctx) {
    throw new Error("useReposStore must be used within ReposProvider")
  }
  return ctx
}
