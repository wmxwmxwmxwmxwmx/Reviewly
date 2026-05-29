"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { AiPersistedContent, SecurityCenterFinding } from "@reviewly/shared"

import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { PrismApiError } from "@/lib/api/client"
import {
  explainSecurityFinding,
  fetchSecurityFindings,
  fetchSecurityStats,
  patchSecurityFinding,
  type SecurityStats,
} from "@/lib/api/security"
import { usePersistedViewState } from "@/hooks/use-persisted-view-state"

const PAGE_SIZE = 10

function buildAiInsight(content: string, model: string, provider: string): AiPersistedContent {
  return {
    content,
    analyzedAt: new Date().toISOString(),
    model,
    provider,
  }
}

export function useSecurityCenter() {
  const { settings } = useAISettings()
  const [items, setItems] = useState<SecurityCenterFinding[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [viewState, setViewState] = usePersistedViewState("security", {
    severityFilter: "",
    repoFilter: "",
    searchInput: "",
    filtersOpen: true,
  })
  const severityFilter = viewState.severityFilter
  const repoFilter = viewState.repoFilter
  const searchInput = viewState.searchInput
  const filtersOpen = viewState.filtersOpen
  const setSeverityFilter = (severityFilter: string) => setViewState({ severityFilter })
  const setRepoFilter = (repoFilter: string) => setViewState({ repoFilter })
  const setSearchInput = (searchInput: string) => setViewState({ searchInput })
  const setFiltersOpen = (filtersOpen: boolean) => setViewState({ filtersOpen })
  const [searchQuery, setSearchQuery] = useState("")

  const [explainingId, setExplainingId] = useState<string | null>(null)
  const [explainText, setExplainText] = useState("")
  const [explainError, setExplainError] = useState<string | null>(null)
  const explainAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [severityFilter, repoFilter, searchQuery])

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const [findingsRes, statsRes] = await Promise.all([
        fetchSecurityFindings({
          severity: severityFilter || undefined,
          repo: repoFilter || undefined,
          q: searchQuery || undefined,
          page,
          pageSize: PAGE_SIZE,
          signal,
        }),
        fetchSecurityStats(signal),
      ])
      setItems(findingsRes.items)
      setTotal(findingsRes.total)
      setStats(statsRes)
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return
      setError(e instanceof PrismApiError ? e.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [severityFilter, repoFilter, searchQuery, page])

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  )

  const prepareExplain = useCallback((finding: SecurityCenterFinding) => {
    setExplainText(finding.aiInsight?.content ?? "")
    setExplainError(null)
  }, [])

  const explainFinding = useCallback(
    async (findingId: string) => {
      explainAbort.current?.abort()
      const ac = new AbortController()
      explainAbort.current = ac
      setExplainingId(findingId)
      setExplainText("")
      setExplainError(null)

      let accumulated = ""

      await explainSecurityFinding(findingId, {
        signal: ac.signal,
        onDelta: (delta) => {
          accumulated += delta
          setExplainText((prev) => prev + delta)
        },
        onError: (msg) => setExplainError(msg),
        onDone: async () => {
          setExplainingId((id) => (id === findingId ? null : id))
          if (!accumulated.trim()) return
          try {
            const insight = buildAiInsight(
              accumulated,
              settings.model,
              settings.provider,
            )
            await patchSecurityFinding(findingId, { aiInsight: insight })
            setItems((prev) =>
              prev.map((item) =>
                item.id === findingId ? { ...item, aiInsight: insight } : item,
              ),
            )
          } catch (e: unknown) {
            setExplainError(
              e instanceof PrismApiError ? e.message : "保存解读失败",
            )
          }
        },
      })
    },
    [settings.model, settings.provider],
  )

  const cancelExplain = useCallback(() => {
    explainAbort.current?.abort()
    setExplainingId(null)
  }, [])

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages,
    setPage,
    stats,
    loading,
    error,
    severityFilter,
    setSeverityFilter,
    repoFilter,
    setRepoFilter,
    searchInput,
    setSearchInput,
    filtersOpen,
    setFiltersOpen,
    explainingId,
    explainText,
    explainError,
    prepareExplain,
    explainFinding,
    cancelExplain,
  }
}
