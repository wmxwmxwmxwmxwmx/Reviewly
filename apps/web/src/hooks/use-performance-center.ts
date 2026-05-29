"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { PerformanceCenterFinding } from "@reviewly/shared"

import { PrismApiError } from "@/lib/api/client"
import {
  fetchPerformanceFindings,
  fetchPerformanceStats,
  optimizePerformanceFinding,
  type PerformanceStats,
} from "@/lib/api/performance"

const PAGE_SIZE = 10

export function usePerformanceCenter() {
  const [items, setItems] = useState<PerformanceCenterFinding[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [severityFilter, setSeverityFilter] = useState<string>("")
  const [typeFilter, setTypeFilter] = useState<string>("")
  const [repoFilter, setRepoFilter] = useState<string>("")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const [optimizingId, setOptimizingId] = useState<string | null>(null)
  const [optimizeText, setOptimizeText] = useState("")
  const [optimizeError, setOptimizeError] = useState<string | null>(null)
  const optimizeAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [severityFilter, typeFilter, repoFilter, searchQuery])

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const [findingsRes, statsRes] = await Promise.all([
        fetchPerformanceFindings({
          severity: severityFilter || undefined,
          type: typeFilter || undefined,
          repo: repoFilter || undefined,
          q: searchQuery || undefined,
          page,
          pageSize: PAGE_SIZE,
          signal,
        }),
        fetchPerformanceStats(signal),
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
  }, [severityFilter, typeFilter, repoFilter, searchQuery, page])

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const groupedByType = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      map.set(item.type, (map.get(item.type) ?? 0) + 1)
    }
    return map
  }, [items])

  const optimizeFinding = useCallback(async (findingId: string) => {
    optimizeAbort.current?.abort()
    const ac = new AbortController()
    optimizeAbort.current = ac
    setOptimizingId(findingId)
    setOptimizeText("")
    setOptimizeError(null)

    await optimizePerformanceFinding(findingId, {
      signal: ac.signal,
      onDelta: (delta) => setOptimizeText((prev) => prev + delta),
      onError: (msg) => setOptimizeError(msg),
      onDone: () => setOptimizingId((id) => (id === findingId ? null : id)),
    })
  }, [])

  const cancelOptimize = useCallback(() => {
    optimizeAbort.current?.abort()
    setOptimizingId(null)
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
    typeFilter,
    setTypeFilter,
    repoFilter,
    setRepoFilter,
    searchInput,
    setSearchInput,
    groupedByType,
    optimizingId,
    optimizeText,
    optimizeError,
    optimizeFinding,
    cancelOptimize,
  }
}
