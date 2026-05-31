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
import { PrismApiError } from "@/lib/api/client"
import { completeChat } from "@/lib/api/ai-chat"
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
import {
  buildAnalyzePrompt,
  REPO_ANALYSIS_SYSTEM_PROMPT,
} from "@/lib/ai/repo-analysis-prompt"

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
      await syncManagedReposPullRequests(data, undefined, "manual")
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

        const chat = await completeChat(
          {
            provider: settings.provider,
            model: settings.model,
            apiKey: settings.apiKey,
            messages: [
              { role: "system", content: REPO_ANALYSIS_SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
          },
          ac.signal,
        )

        if (ac.signal.aborted) return

        const content = chat.content || "模型未返回内容。"
        const updated = await saveRepoAiAnalysis(repoId, {
          content,
          model: settings.model,
          provider: settings.provider,
        })
        setRepos((prev) => prev.map((r) => (r.id === repoId ? updated : r)))

        const totalTokens = Number(chat.usage?.totalTokens) || 0
        const promptTokens = Number(chat.usage?.promptTokens) || 0
        const completionTokens = Number(chat.usage?.completionTokens) || 0
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
          latencyMs: Number(chat.latencyMs) || 0,
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
