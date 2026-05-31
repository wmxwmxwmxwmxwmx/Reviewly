"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import type { Repository, SyncRepositoriesResponse } from "@reviewly/shared"

import { estimateCostCnyFromUsage } from "@/lib/ai/pricing"
import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { useRunningTask } from "@/features/prism/contexts/running-tasks-context"
import { extractApiErrorMessage, parseFetchJson, PrismApiError } from "@/lib/api/client"
import { getAuthToken } from "@/lib/auth/storage"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { useReposSync } from "@/hooks/use-repos-sync"
import { useAuth } from "@/features/prism/contexts/auth-context"
import {
  fetchRepoAnalyzeContext,
  fetchRepos,
  removeRepository,
  saveRepoAiAnalysis,
  syncMyRepositories,
} from "@/lib/api/repos"
import { syncManagedReposPullRequests } from "@/lib/repos/sync-managed-prs"

interface ReposContextValue {
  repos: Repository[]
  loading: boolean
  syncing: boolean
  importing: boolean
  error: string | null
  syncError: string | null
  analyzingRepoId: string | null
  analysisErrorsByRepoId: Record<string, string>
  refresh: () => Promise<void>
  sync: () => Promise<SyncRepositoriesResponse>
  importRepo: (url: string) => Promise<Repository | null>
  analyzeRepository: (repoId: string) => Promise<void>
  removeRepo: (repoId: string) => Promise<void>
  removingRepoId: string | null
  clearAnalysisError: (repoId: string) => void
}

const ReposContext = createContext<ReposContextValue | null>(null)

function buildAnalyzePrompt(
  repo: Repository,
  findings: { title: string; severity: string; file: string; line: number; description?: string }[],
  ctx: {
    readme: string
    fileTree?: string
    configSnippets?: Record<string, string>
    contextWarnings?: string[]
  },
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

  const warningsBlock =
    ctx.contextWarnings && ctx.contextWarnings.length > 0
      ? ctx.contextWarnings.map((w) => `- ${w}`).join("\n")
      : "（无）"

  const configBlock =
    ctx.configSnippets && Object.keys(ctx.configSnippets).length > 0
      ? Object.entries(ctx.configSnippets)
          .map(([path, body]) => `### ${path}\n\`\`\`\n${body}\n\`\`\``)
          .join("\n\n")
      : "（未获取到 package.json / pyproject.toml 等配置文件）"

  return `请分析以下 GitHub 仓库，用中文 Markdown 输出，必须包含四个二级标题：

## 项目复杂度分析
## 技术栈分析
## 风险模块推测
## 可维护性分析

要求：
- 必须基于下方 README、目录树、配置文件与 findings 作答；禁止仅根据仓库名猜测。
- 若某类数据缺失，在对应章节明确说明「数据不足」并给出有限结论。

仓库：${repo.fullName}
描述：${repo.description ?? "（无）"}
语言（GitHub）：${repo.language ?? "（未知）"}
默认分支：${repo.defaultBranch}
开放 PR 数：${repo.openPrCount}
健康度：${repo.healthScore}
是否私有：${repo.isPrivate ? "是" : "否"}

上下文告警：
${warningsBlock}

最近 PR Findings：
${findingsBlock}

仓库文件路径（节选）：
${ctx.fileTree?.trim() || "（无法获取目录树）"}

关键配置文件：
${configBlock}

README（节选）：
${ctx.readme?.trim() || "（无法获取 README）"}`
}

export function ReposProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { settings, hasApiKey, recordUsage } = useAISettings()
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [analyzingRepoId, setAnalyzingRepoId] = useState<string | null>(null)
  const [removingRepoId, setRemovingRepoId] = useState<string | null>(null)
  const [analysisErrorsByRepoId, setAnalysisErrorsByRepoId] = useState<Record<string, string>>({})
  const analyzeAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      analyzeAbortRef.current?.abort()
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRepos({ type: "all" })
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

  const {
    importing,
    syncing,
    importRepo: importRepoMutation,
    syncRepos: syncReposMutation,
  } = useReposSync(refresh)

  useRunningTask("pullRequests", syncing)

  const sync = useCallback(async () => {
    setSyncError(null)
    try {
      let result: SyncRepositoriesResponse
      if (isAuthenticated) {
        result = await syncMyRepositories()
      } else {
        result = await syncReposMutation()
      }
      const data = await fetchRepos({ type: "all" })
      setRepos(data)
      await syncManagedReposPullRequests(data)
      const afterPrSync = await fetchRepos({ type: "all" })
      setRepos(afterPrSync)
      return result
    } catch (e: unknown) {
      setSyncError(e instanceof PrismApiError ? e.message : "同步失败")
      throw e
    }
  }, [isAuthenticated, syncReposMutation])

  const importRepo = useCallback(
    async (url: string) => {
      setSyncError(null)
      try {
        return await importRepoMutation(url)
      } catch (e: unknown) {
        setSyncError(e instanceof PrismApiError ? e.message : "添加仓库失败")
        throw e
      }
    },
    [importRepoMutation],
  )

  const clearAnalysisError = useCallback((repoId: string) => {
    setAnalysisErrorsByRepoId((prev) => {
      if (!prev[repoId]) return prev
      const next = { ...prev }
      delete next[repoId]
      return next
    })
  }, [])

  const removeRepo = useCallback(
    async (repoId: string) => {
      setSyncError(null)
      setRemovingRepoId(repoId)
      try {
        await removeRepository(repoId)
        setRepos((prev) => prev.filter((r) => r.id !== repoId))
        setAnalysisErrorsByRepoId((prev) => {
          if (!prev[repoId]) return prev
          const next = { ...prev }
          delete next[repoId]
          return next
        })
        await refresh()
      } catch (e: unknown) {
        setSyncError(e instanceof PrismApiError ? e.message : "取消管理失败")
        throw e
      } finally {
        setRemovingRepoId((current) => (current === repoId ? null : current))
      }
    },
    [refresh],
  )

  const analyzeRepository = useCallback(
    async (repoId: string) => {
      if (!hasApiKey) {
        setAnalysisErrorsByRepoId((prev) => ({
          ...prev,
          [repoId]: "请先在系统设置中填写 API 密钥。",
        }))
        return
      }

      setAnalyzingRepoId(repoId)
      setAnalysisErrorsByRepoId((prev) => {
        if (!prev[repoId]) return prev
        const next = { ...prev }
        delete next[repoId]
        return next
      })

      analyzeAbortRef.current?.abort()
      const ac = new AbortController()
      analyzeAbortRef.current = ac

      try {
        const ctx = await fetchRepoAnalyzeContext(repoId)
        if (ac.signal.aborted) return

        const hasTree = Boolean(ctx.fileTree?.trim())
        const hasReadme = Boolean(ctx.readme?.trim())
        const hasConfigs =
          ctx.configSnippets != null && Object.keys(ctx.configSnippets).length > 0
        if (!hasTree && !hasReadme && !hasConfigs && ctx.contextWarnings?.length) {
          throw new Error(ctx.contextWarnings.join("；"))
        }

        const prompt = buildAnalyzePrompt(ctx.repository, ctx.recentFindings, {
          readme: ctx.readme,
          fileTree: ctx.fileTree,
          configSnippets: ctx.configSnippets,
          contextWarnings: ctx.contextWarnings,
        })

        const authToken = getAuthToken()
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          signal: ac.signal,
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            provider: settings.provider,
            model: settings.model,
            ...(settings.apiKey.trim() ? { apiKey: settings.apiKey.trim() } : {}),
            messages: [
              {
                role: "system",
                content:
                  "你是资深架构师与代码评审专家。仅基于用户提供的仓库元数据、目录树、配置文件、findings 与 README 分析；禁止编造未在上下文中出现的文件路径或依赖。",
              },
              { role: "user", content: prompt },
            ],
          }),
        })

        const data = await parseFetchJson<{
          content?: string
          usage?: { totalTokens?: number; promptTokens?: number; completionTokens?: number }
          latencyMs?: number
        }>(response)
        if (!response.ok) {
          throw new Error(extractApiErrorMessage(data, "AI 分析失败"))
        }

        if (ac.signal.aborted) return

        const content = data?.content || "模型未返回内容。"
        const updated = await saveRepoAiAnalysis(repoId, {
          content,
          model: settings.model,
          provider: settings.provider,
        })
        setRepos((prev) => prev.map((r) => (r.id === repoId ? updated : r)))

        const totalTokens = Number(data?.usage?.totalTokens) || 0
        const promptTokens = Number(data?.usage?.promptTokens) || 0
        const completionTokens = Number(data?.usage?.completionTokens) || 0
        recordUsage({
          provider: settings.provider,
          model: settings.model,
          promptTokens,
          completionTokens,
          totalTokens,
          costCny: estimateCostCnyFromUsage(
            settings.provider,
            settings.model,
            promptTokens,
            completionTokens,
          ),
          latencyMs: Number(data?.latencyMs) || 0,
        })
      } catch (e: unknown) {
        if (isAbortError(e)) return
        setAnalysisErrorsByRepoId((prev) => ({
          ...prev,
          [repoId]: e instanceof Error ? e.message : "AI 分析失败",
        }))
      } finally {
        if (shouldApplyResult(ac.signal)) {
          setAnalyzingRepoId((current) => (current === repoId ? null : current))
        }
      }
    },
    [hasApiKey, settings, recordUsage],
  )

  const contextValue = useMemo(
    () => ({
      repos,
      loading,
      syncing,
      importing,
      error,
      syncError,
      analyzingRepoId,
      analysisErrorsByRepoId,
      removingRepoId,
      refresh,
      sync,
      importRepo,
      analyzeRepository,
      removeRepo,
      clearAnalysisError,
    }),
    [
      repos,
      loading,
      syncing,
      importing,
      error,
      syncError,
      analyzingRepoId,
      analysisErrorsByRepoId,
      removingRepoId,
      refresh,
      sync,
      importRepo,
      analyzeRepository,
      removeRepo,
      clearAnalysisError,
    ],
  )

  return (
    <ReposContext.Provider value={contextValue}>
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
