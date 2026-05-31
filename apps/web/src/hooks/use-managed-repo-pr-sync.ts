"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useReposStore } from "@/features/prism/contexts/repos-context"
import {
  ATTENTION_STATE_EVENT,
  countAttentionStates,
} from "@/features/prism/lib/review-attention-state"
import { computeInboxItems } from "@/features/prism/ai/review-attention-score"
import { isRepositoryManaged } from "@/lib/repos/is-repository-managed"
import { repoManagementDisplayOrder } from "@/lib/repos-utils"
import { syncRepoPullRequests } from "@/lib/api/repos"
import { usePullRequests } from "@/hooks/use-pull-requests"

const SYNC_INTERVAL_MS = 5 * 60 * 1000
const FOCUS_DEBOUNCE_MS = 60 * 1000
const KNOWN_PR_KEY = "prism:known-pr-ids"

export type SyncBadgeState = {
  newPrCount: number
  revisitCount: number
}

function readKnownPrIds(): Record<string, string[]> {
  if (typeof sessionStorage === "undefined") return {}
  try {
    const raw = sessionStorage.getItem(KNOWN_PR_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

function writeKnownPrIds(map: Record<string, string[]>): void {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(KNOWN_PR_KEY, JSON.stringify(map))
}

export function useReviewAttentionCounts() {
  const [tick, setTick] = useState(0)
  const { items, loading, reload } = usePullRequests({
    includeExternal: "false",
    limit: "100",
    includeCounts: "false",
  })

  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener(ATTENTION_STATE_EVENT, bump)
    return () => window.removeEventListener(ATTENTION_STATE_EVENT, bump)
  }, [])

  const managed = items.filter(isRepositoryManaged)
  void tick
  const { unread, needsRevisit, badge } = countAttentionStates(managed)
  const allInboxItems = computeInboxItems(managed)

  return {
    loading,
    reload,
    unread,
    needsRevisit,
    badge,
    allInboxItems,
    managedItems: managed,
  }
}

export function useManagedRepoPrSyncLoop(options: {
  enabled?: boolean
  onSynced?: () => void
} = {}) {
  const { enabled = true, onSynced } = options
  const { repos } = useReposStore()
  const managedRepos = repoManagementDisplayOrder(repos).filter(isRepositoryManaged)
  const syncingRef = useRef(false)
  const lastFocusRef = useRef(0)
  const [syncBadges, setSyncBadges] = useState<SyncBadgeState>({
    newPrCount: 0,
    revisitCount: 0,
  })
  const { items, reload } = usePullRequests({
    includeExternal: "false",
    limit: "100",
    includeCounts: "false",
  })

  const detectBadges = useCallback(() => {
    const managed = items.filter(isRepositoryManaged)
    const known = readKnownPrIds()
    let newPrCount = 0
    const nextKnown: Record<string, string[]> = { ...known }

    for (const pr of managed) {
      const prev = known[pr.repoId] ?? []
      if (prev.length > 0 && !prev.includes(pr.id)) newPrCount += 1
      const list = nextKnown[pr.repoId] ?? []
      if (!list.includes(pr.id)) nextKnown[pr.repoId] = [...list, pr.id]
    }

    writeKnownPrIds(nextKnown)
    const { needsRevisit } = countAttentionStates(managed)
    setSyncBadges({ newPrCount, revisitCount: needsRevisit })
  }, [items])

  const syncAll = useCallback(async () => {
    if (!enabled || syncingRef.current || managedRepos.length === 0) return
    syncingRef.current = true
    try {
      for (const repo of managedRepos) {
        try {
          await syncRepoPullRequests(repo.id)
        } catch {
          /* skip failed repo */
        }
      }
      reload()
      onSynced?.()
    } finally {
      syncingRef.current = false
    }
  }, [enabled, managedRepos, onSynced, reload])

  useEffect(() => {
    if (!enabled) return
    void syncAll()
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => void syncAll(), SYNC_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [enabled, syncAll])

  useEffect(() => {
    if (!enabled) return
    const onFocus = () => {
      const now = Date.now()
      if (now - lastFocusRef.current < FOCUS_DEBOUNCE_MS) return
      lastFocusRef.current = now
      void syncAll()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [enabled, syncAll])

  useEffect(() => {
    detectBadges()
  }, [detectBadges, items])

  return { syncBadges, syncAll }
}
