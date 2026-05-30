"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { AiPersistedContent, PerformanceCenterFinding } from "@reviewly/shared"

import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { useRunningTask } from "@/features/prism/contexts/running-tasks-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { PrismApiError } from "@/lib/api/client"
import {
  fetchPerformanceFindings,
  fetchPerformanceStats,
  optimizePerformanceFinding,
  patchPerformanceFinding,
  type PerformanceStats,
} from "@/lib/api/performance"
import { usePersistedViewState } from "@/hooks/use-persisted-view-state"
import { repoManagementDisplayOrder } from "@/lib/repos-utils"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"

const PAGE_SIZE = 10

function buildAiOptimization(
  content: string,
  model: string,
  provider: string,
): AiPersistedContent {
  return {
    content,
    analyzedAt: new Date().toISOString(),
    model,
    provider,
  }
}

export function usePerformanceCenter() {
  const { settings } = useAISettings()
  const { repos, loading: reposLoading } = useReposStore()
  const managedRepos = useMemo(() => repoManagementDisplayOrder(repos), [repos])
  const managedRepoNames = useMemo(
    () => new Set(managedRepos.map((repo) => repo.fullName)),
    [managedRepos],
  )
  const [items, setItems] = useState<PerformanceCenterFinding[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [viewState, setViewState] = usePersistedViewState("performance", {
    severityFilter: "",
    typeFilter: "",
    repoFilter: "",
    searchInput: "",
    filtersOpen: true,
    expandedFindingId: null as string | null,
  })
  const severityFilter = viewState.severityFilter
  const typeFilter = viewState.typeFilter
  const repoFilter = viewState.repoFilter
  const searchInput = viewState.searchInput
  const filtersOpen = viewState.filtersOpen
  const expandedFindingId = viewState.expandedFindingId
  const setSeverityFilter = (severityFilter: string) => setViewState({ severityFilter })
  const setTypeFilter = (typeFilter: string) => setViewState({ typeFilter })
  const setRepoFilter = (repoFilter: string) => setViewState({ repoFilter })
  const setSearchInput = (searchInput: string) => setViewState({ searchInput })
  const setFiltersOpen = (filtersOpen: boolean) => setViewState({ filtersOpen })
  const setExpandedFindingId = (expandedFindingId: string | null) =>
    setViewState({ expandedFindingId })
  const effectiveRepoFilter = useMemo(() => {
    if (managedRepos.length === 0) return ""
    if (repoFilter && managedRepoNames.has(repoFilter)) return repoFilter
    return managedRepos[0].fullName
  }, [managedRepos, managedRepoNames, repoFilter])
  const [searchQuery, setSearchQuery] = useState("")

  const [optimizingId, setOptimizingId] = useState<string | null>(null)
  const [optimizeText, setOptimizeText] = useState("")
  const [optimizeError, setOptimizeError] = useState<string | null>(null)
  const optimizeAbort = useRef<AbortController | null>(null)

  useRunningTask("performance", optimizingId !== null)

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (reposLoading || managedRepos.length === 0) return
    if (repoFilter !== effectiveRepoFilter) {
      setRepoFilter(effectiveRepoFilter)
    }
  }, [reposLoading, managedRepos.length, repoFilter, effectiveRepoFilter, setRepoFilter])

  useEffect(() => {
    setPage(1)
  }, [severityFilter, typeFilter, effectiveRepoFilter, searchQuery])

  const load = useCallback(async (signal: AbortSignal) => {
    if (reposLoading) return
    if (managedRepos.length === 0) {
      setItems([])
      setTotal(0)
      setStats(null)
      setLoading(false)
      setError(null)
      return
    }
    if (!effectiveRepoFilter) return

    setLoading(true)
    setError(null)
    try {
      const [findingsRes, statsRes] = await Promise.all([
        fetchPerformanceFindings({
          severity: severityFilter || undefined,
          type: typeFilter || undefined,
          repo: effectiveRepoFilter,
          q: searchQuery || undefined,
          page,
          pageSize: PAGE_SIZE,
          signal,
        }),
        fetchPerformanceStats({ repo: effectiveRepoFilter, signal }),
      ])
      setItems(findingsRes.items)
      setTotal(findingsRes.total)
      setStats(statsRes)
    } catch (e: unknown) {
      if (isAbortError(e)) return
      setError(e instanceof PrismApiError ? e.message : "加载失败")
    } finally {
      if (shouldApplyResult(signal)) setLoading(false)
    }
  }, [
    reposLoading,
    managedRepos.length,
    severityFilter,
    typeFilter,
    effectiveRepoFilter,
    searchQuery,
    page,
  ])

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  useEffect(() => {
    return () => {
      optimizeAbort.current?.abort()
    }
  }, [])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const groupedByType = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      map.set(item.type, (map.get(item.type) ?? 0) + 1)
    }
    return map
  }, [items])

  const collapseOptimize = useCallback(() => {
    setExpandedFindingId(null)
  }, [setExpandedFindingId])

  const optimizeFinding = useCallback(
    async (findingId: string) => {
      optimizeAbort.current?.abort()
      const ac = new AbortController()
      optimizeAbort.current = ac
      setOptimizingId(findingId)
      setOptimizeText("")
      setOptimizeError(null)

      let accumulated = ""

      try {
        await optimizePerformanceFinding(findingId, {
          signal: ac.signal,
          onDelta: (delta) => {
            accumulated += delta
            setOptimizeText((prev) => prev + delta)
          },
          onError: (msg) => {
            setOptimizeError(msg)
            setOptimizingId((id) => (id === findingId ? null : id))
          },
          onDone: async () => {
            if (ac.signal.aborted) return
            setOptimizingId((id) => (id === findingId ? null : id))
            if (!accumulated.trim()) return
            try {
              const aiOptimization = buildAiOptimization(
                accumulated,
                settings.model,
                settings.provider,
              )
              await patchPerformanceFinding(findingId, { aiOptimization })
              setItems((prev) =>
                prev.map((item) =>
                  item.id === findingId ? { ...item, aiOptimization } : item,
                ),
              )
            } catch (e: unknown) {
              setOptimizeError(
                e instanceof PrismApiError ? e.message : "保存优化方案失败",
              )
            }
          },
        })
      } catch (e: unknown) {
        if (isAbortError(e)) return
        setOptimizeError(e instanceof Error ? e.message : "优化失败")
      } finally {
        setOptimizingId((id) => (id === findingId ? null : id))
      }
    },
    [settings.model, settings.provider],
  )

  const startOptimize = useCallback(
    (finding: PerformanceCenterFinding) => {
      if (expandedFindingId === finding.id && !optimizingId) {
        collapseOptimize()
        return
      }

      setExpandedFindingId(finding.id)
      setOptimizeError(null)

      const cached = finding.aiOptimization?.content
      if (cached) {
        setOptimizeText(cached)
        return
      }

      void optimizeFinding(finding.id)
    },
    [expandedFindingId, optimizingId, collapseOptimize, setExpandedFindingId, optimizeFinding],
  )

  const regenerateOptimize = useCallback(
    (finding: PerformanceCenterFinding) => {
      setExpandedFindingId(finding.id)
      void optimizeFinding(finding.id)
    },
    [setExpandedFindingId, optimizeFinding],
  )

  const cancelOptimize = useCallback(() => {
    optimizeAbort.current?.abort()
    setOptimizingId(null)
    setOptimizeText("")
  }, [])

  const reload = useCallback(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages,
    setPage,
    stats,
    loading: loading || reposLoading,
    error,
    reload,
    managedRepos,
    severityFilter,
    setSeverityFilter,
    typeFilter,
    setTypeFilter,
    repoFilter,
    setRepoFilter,
    searchInput,
    setSearchInput,
    filtersOpen,
    setFiltersOpen,
    groupedByType,
    expandedFindingId,
    optimizingId,
    optimizeText,
    optimizeError,
    startOptimize,
    regenerateOptimize,
    collapseOptimize,
    cancelOptimize,
  }
}
