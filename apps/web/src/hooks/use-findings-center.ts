"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { AiPersistedContent, UnifiedFinding } from "@reviewly/shared"

import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { useRunningTask } from "@/features/prism/contexts/running-tasks-context"
import type { FindingsTab } from "@/features/prism/contexts/navigation-context"
import { PrismApiError } from "@/lib/api/client"
import { fetchFindings } from "@/lib/api/findings"
import { explainSecurityFinding } from "@/lib/api/security"
import { optimizePerformanceFinding } from "@/lib/api/performance"
import { useFindingsStatsOptional } from "@/features/prism/contexts/findings-stats-context"
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

export function useFindingsCenter(initialTab: FindingsTab = "all") {
  const { settings } = useAISettings()
  const findingsStatsCtx = useFindingsStatsOptional()
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
  const [trends, setTrends] = useState<{
    last7Days: { date: string; count: number }[]
    last30Days: { date: string; count: number }[]
  }>({ last7Days: [], last30Days: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [tab, severityFilter, repoFilter, statusFilter, searchQuery])

  useEffect(() => {
    findingsStatsCtx?.setStats(stats)
  }, [stats, findingsStatsCtx])

  const apiType = tab === "all" ? undefined : tab

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
          signal,
        })
        setItems(res.items)
        setTotal(res.total)
        setStats(res.stats)
        setTrends(res.trends)
      } catch (e: unknown) {
        if (isAbortError(e)) return
        setError(e instanceof PrismApiError ? e.message : "加载失败")
      } finally {
        if (shouldApplyResult(signal)) setLoading(false)
      }
    },
    [apiType, severityFilter, repoFilter, statusFilter, searchQuery, page],
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

  const prepareAi = useCallback((finding: UnifiedFinding) => {
    aiAbort.current?.abort()
    setAiFindingId(finding.id)
    setAiError(null)
    const cached = finding.aiInsight?.content
    setAiText(cached ?? "")
  }, [])

  const runAi = useCallback(
    async (finding: UnifiedFinding) => {
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
        } else {
          await optimizePerformanceFinding(finding.id, streamOpts)
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

  return {
    tab,
    setTab,
    items,
    total,
    page,
    totalPages,
    setPage,
    stats,
    trends,
    loading,
    error,
    reload,
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
    prepareAi,
    runAi,
    cancelAi,
  }
}
