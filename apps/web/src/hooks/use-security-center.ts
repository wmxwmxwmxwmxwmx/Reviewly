"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { SecurityCenterFinding } from "@reviewly/shared"

import { PrismApiError } from "@/lib/api/client"
import {
  explainSecurityFinding,
  fetchSecurityFindings,
  fetchSecurityStats,
  type SecurityStats,
} from "@/lib/api/security"

const PAGE_SIZE = 10

export function useSecurityCenter() {
  const [items, setItems] = useState<SecurityCenterFinding[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [severityFilter, setSeverityFilter] = useState<string>("")
  const [repoFilter, setRepoFilter] = useState<string>("")
  const [searchInput, setSearchInput] = useState("")
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

  const explainFinding = useCallback(async (findingId: string) => {
    explainAbort.current?.abort()
    const ac = new AbortController()
    explainAbort.current = ac
    setExplainingId(findingId)
    setExplainText("")
    setExplainError(null)

    await explainSecurityFinding(findingId, {
      signal: ac.signal,
      onDelta: (delta) => setExplainText((prev) => prev + delta),
      onError: (msg) => setExplainError(msg),
      onDone: () => setExplainingId((id) => (id === findingId ? null : id)),
    })
  }, [])

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
    explainingId,
    explainText,
    explainError,
    explainFinding,
    cancelExplain,
  }
}
