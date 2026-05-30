"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type {
  AiPersistedContent,
  FindingCategory,
  FindingsCategoryStats,
  UnifiedFinding,
} from "@reviewly/shared"

import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { useRunningTask } from "@/features/prism/contexts/running-tasks-context"
import type { FindingsTab } from "@/features/prism/contexts/navigation-context"
import { PrismApiError } from "@/lib/api/client"
import { fetchFindings, patchFinding } from "@/lib/api/findings"
import { explainSecurityFinding } from "@/lib/api/security"
import { optimizePerformanceFinding } from "@/lib/api/performance"
import { EMPTY_CATEGORY_COUNTS } from "@/lib/findings-categories"
import { usePersistedViewState } from "@/hooks/use-persisted-view-state"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"

const PAGE_SIZE = 20

function buildAiInsight(content: string, model: string, provider: string): AiPersistedContent {
  return {
    content,
    analyzedAt: new Date().toISOString(),
    model,
    provider,
  }
}

function tabToCategory(tab: FindingsTab): FindingCategory | undefined {
  return tab === "all" ? undefined : tab
}

export function useFindingsCenter(initialTab: FindingsTab = "all") {
  const { settings } = useAISettings()
  const [tab, setTab] = useState<FindingsTab>(initialTab)
  const [items, setItems] = useState<UnifiedFinding[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  })
  const [categoryStats, setCategoryStats] = useState<FindingsCategoryStats>({
    counts: { ...EMPTY_CATEGORY_COUNTS },
    maxSeverity: {},
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<"createdAt" | "severity">("createdAt")
  const [actionLoading, setActionLoading] = useState(false)

  const [viewState, setViewState] = usePersistedViewState("findings", {
    severityFilter: "",
    repoFilter: "",
    statusFilter: "",
    searchInput: "",
    filtersOpen: true,
  })
  const severityFilter = viewState.severityFilter
  const repoFilter = viewState.repoFilter
  const statusFilter = viewState.statusFilter
  const searchInput = viewState.searchInput
  const filtersOpen = viewState.filtersOpen
  const setSeverityFilter = (severityFilter: string) => setViewState({ severityFilter })
  const setRepoFilter = (repoFilter: string) => setViewState({ repoFilter })
  const setStatusFilter = (statusFilter: string) => setViewState({ statusFilter })
  const setSearchInput = (searchInput: string) => setViewState({ searchInput })
  const setFiltersOpen = (filtersOpen: boolean) => setViewState({ filtersOpen })
  const [searchQuery, setSearchQuery] = useState("")

  const [aiFindingId, setAiFindingId] = useState<string | null>(null)
  const [aiText, setAiText] = useState("")
  const [aiError, setAiError] = useState<string | null>(null)
  const aiAbort = useRef<AbortController | null>(null)

  useRunningTask("security", aiFindingId !== null)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [tab, severityFilter, repoFilter, statusFilter, searchQuery, sort])

  const apiType = tabToCategory(tab)

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchFindings({
          type: apiType,
          severity: severityFilter || undefined,
          repo: repoFilter || undefined,
          status: statusFilter || undefined,
          q: searchQuery || undefined,
          page,
          pageSize: PAGE_SIZE,
          sort,
          signal,
        })
        setItems(res.items)
        setTotal(res.total)
        setStats(res.stats)
        setCategoryStats(res.categoryStats)
      } catch (e: unknown) {
        if (isAbortError(e)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      } finally {
        if (shouldApplyResult(signal)) setLoading(false)
      }
    },
    [apiType, severityFilter, repoFilter, statusFilter, searchQuery, page, sort],
  )

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const reload = useCallback(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const setCategoryFilter = useCallback((category: FindingCategory | null) => {
    setTab(category ?? "all")
    setPage(1)
  }, [])

  const categoryFilter = tab === "all" ? null : tab

  const prepareAi = useCallback((finding: UnifiedFinding) => {
    aiAbort.current?.abort()
    setAiFindingId(finding.id)
    setAiError(null)
    const cached = finding.aiInsight?.content
    setAiText(cached ?? "")
  }, [])

  const runAi = useCallback(
    async (finding: UnifiedFinding) => {
      if (finding.findingType === "convention" || finding.findingType === "architecture") {
        setAiError("该类型暂不支持流式 AI，请查看规则描述与修复建议。")
        return
      }
      aiAbort.current?.abort()
      const ac = new AbortController()
      aiAbort.current = ac
      setAiFindingId(finding.id)
      setAiError(null)
      setAiText("")

      let accumulated = ""
      const streamOpts = {
        signal: ac.signal,
        onDelta: (delta: string) => {
          accumulated += delta
          setAiText((prev) => prev + delta)
        },
        onError: (msg: string) => {
          setAiError(msg)
          setAiFindingId(null)
        },
        onDone: () => {
          if (ac.signal.aborted || !accumulated.trim()) return
          const insight = buildAiInsight(accumulated, settings.model, settings.provider)
          setItems((prev) =>
            prev.map((item) => (item.id === finding.id ? { ...item, aiInsight: insight } : item)),
          )
        },
      }

      try {
        if (finding.findingType === "security") {
          await explainSecurityFinding(finding.id, streamOpts)
        } else if (finding.findingType === "performance") {
          await optimizePerformanceFinding(finding.id, streamOpts)
        } else {
          setAiError("该类型暂不支持流式 AI 解读")
        }
      } catch (e: unknown) {
        if (isAbortError(e)) return
        setAiError(e instanceof PrismApiError ? e.message : "AI 生成失败")
      } finally {
        if (shouldApplyResult(ac.signal)) setAiFindingId(null)
      }
    },
    [settings.model, settings.provider],
  )

  const cancelAi = useCallback(() => {
    aiAbort.current?.abort()
    setAiFindingId(null)
  }, [])

  const updateStatus = useCallback(
    async (finding: UnifiedFinding, status: "open" | "ignored" | "resolved") => {
      setActionLoading(true)
      setError(null)
      try {
        const updated = await patchFinding(finding.id, { status })
        setItems((prev) => prev.map((item) => (item.id === finding.id ? updated : item)))
        reload()
        return updated
      } catch (e: unknown) {
        setError(e instanceof PrismApiError ? e.message : "更新状态失败")
        return null
      } finally {
        setActionLoading(false)
      }
    },
    [reload],
  )

  const saveNote = useCallback(
    async (finding: UnifiedFinding, note: string) => {
      setActionLoading(true)
      setError(null)
      try {
        const updated = await patchFinding(finding.id, { note })
        setItems((prev) => prev.map((item) => (item.id === finding.id ? updated : item)))
        return updated
      } catch (e: unknown) {
        setError(e instanceof PrismApiError ? e.message : "保存备注失败")
        return null
      } finally {
        setActionLoading(false)
      }
    },
    [],
  )

  return {
    tab,
    setTab,
    categoryFilter,
    setCategoryFilter,
    items,
    total,
    page,
    totalPages,
    setPage,
    stats,
    categoryStats,
    loading,
    error,
    reload,
    sort,
    setSort,
    severityFilter,
    setSeverityFilter,
    repoFilter,
    setRepoFilter,
    statusFilter,
    setStatusFilter,
    searchInput,
    setSearchInput,
    filtersOpen,
    setFiltersOpen,
    aiFindingId,
    aiText,
    aiError,
    actionLoading,
    prepareAi,
    runAi,
    cancelAi,
    updateStatus,
    saveNote,
  }
}
