"use client"

import { useCallback, useEffect, useState } from "react"
import type { PullRequestListItem } from "@reviewly/shared"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"

import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { fetchPullRequests } from "@/lib/api/pull-requests"
import { syncRepoPullRequests } from "@/lib/api/repos"
import { isRepositoryManaged } from "@/lib/repos/is-repository-managed"
import { formatPrismApiError } from "@/lib/api/client"
import { isPrSyncInFlight } from "@/lib/pr-sync-mutex"
import { PR_SYNC_UPDATED_EVENT } from "@/lib/pr-sync-events"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

type RepoPrListProps = {
  repoId: string
  repoFullName: string
}

export function RepoPrList({ repoId, repoFullName }: RepoPrListProps) {
  const { navigate } = useNavigation()
  const { repos } = useReposStore()
  const repoRow = repos.find((r) => r.id === repoId)
  const isManaged = isRepositoryManaged(repoRow)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PullRequestListItem[]>([])

  const fetchList = useCallback(
    async (signal: AbortSignal) => {
      const res = await fetchPullRequests(
        {
          repoId,
          repo: repoFullName,
          limit: "30",
          includeExternal: "true",
        },
        signal,
      )
      return [...res.items].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
    },
    [repoId, repoFullName],
  )

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const sorted = await fetchList(signal)
      setItems(sorted)
    } catch (err) {
      if (signal.aborted) return
      setError(formatPrismApiError(err, zh.repos.prListLoadFailed))
      setItems([])
    } finally {
      if (!signal.aborted) {
        setLoading(false)
      }
    }
  }, [fetchList])

  const syncInBackground = useCallback(
    async (signal: AbortSignal) => {
      if (!isManaged) return
      if (isPrSyncInFlight()) {
        try {
          const sorted = await fetchList(signal)
          if (!signal.aborted) setItems(sorted)
        } catch {
          /* keep cached list */
        }
        return
      }
      setSyncing(true)
      try {
        await syncRepoPullRequests(repoId, signal)
        const sorted = await fetchList(signal)
        if (!signal.aborted) setItems(sorted)
      } catch {
        /* keep cached list if background sync fails */
      } finally {
        if (!signal.aborted) setSyncing(false)
      }
    },
    [fetchList, isManaged, repoId],
  )

  useEffect(() => {
    if (!open) return
    const handler = () => {
      const ac = new AbortController()
      void load(ac.signal)
    }
    window.addEventListener(PR_SYNC_UPDATED_EVENT, handler)
    return () => window.removeEventListener(PR_SYNC_UPDATED_EVENT, handler)
  }, [open, load])

  useEffect(() => {
    setItems([])
    setError(null)
  }, [repoId])

  useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    void load(ac.signal)
    void syncInBackground(ac.signal)
    return () => ac.abort()
  }, [open, load, syncInBackground])

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left text-xs font-medium text-foreground hover:bg-accent transition-colors"
        aria-expanded={open}
      >
        <span>{zh.repos.prListTitle}</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          {open ? zh.repos.collapsePrList : zh.repos.expandPrList}
          {open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </button>
      {open ? (
        <div className="mt-2">
          {loading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {zh.common.loading}
            </p>
          ) : null}
          {!loading && syncing ? (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              {zh.repos.prListSyncing}
            </p>
          ) : null}
          {error ? <p className="text-xs text-risk-high">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{zh.repos.prListEmpty}</p>
              <p className="text-[11px] text-muted-foreground/80">{zh.repos.prListEmptyHint}</p>
            </div>
          ) : null}
          {items.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border bg-surface-3/50 text-muted-foreground">
                    <th className="px-2 py-1.5 text-left font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">{zh.repos.prListColTitle}</th>
                    <th className="px-2 py-1.5 text-left font-medium">{zh.repos.prListColAuthor}</th>
                    <th className="px-2 py-1.5 text-left font-medium">{zh.repos.prListColState}</th>
                    <th className="px-2 py-1.5 text-left font-medium">{zh.repos.prListColRisk}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((pr) => (
                    <tr
                      key={pr.id}
                      className="border-b border-border/60 last:border-0 hover:bg-accent/40 cursor-pointer"
                      onClick={() => navigate("ai-review", { prId: pr.id })}
                    >
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{pr.number}</td>
                      <td className="px-2 py-1.5 max-w-[200px] truncate" title={pr.title}>
                        {pr.title}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{pr.author}</td>
                      <td className="px-2 py-1.5 capitalize">{pr.state}</td>
                      <td className="px-2 py-1.5">
                        <span
                          className={cn(
                            "px-1 py-0.5 rounded text-[10px]",
                            pr.riskLevel === "critical" || pr.riskLevel === "high"
                              ? "text-risk-high bg-risk-high/10"
                              : pr.riskLevel === "medium"
                                ? "text-risk-medium bg-risk-medium/10"
                                : "text-risk-low bg-risk-low/10",
                          )}
                        >
                          {zh.severity[pr.riskLevel]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
