"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { PullRequestListItem } from "@reviewly/shared"

import {
  computeInboxItems,
  filterInboxItems,
  type PrMetrics,
} from "@/features/prism/ai/review-attention-score"
import { ATTENTION_STATE_EVENT } from "@/features/prism/lib/review-attention-state"
import { PR_SYNC_UPDATED_EVENT } from "@/lib/pr-sync-events"
import { enrichTasksWithOpinion } from "@/features/prism/lib/review-task-verdict"
import {
  readPrioritySettings,
  type PrioritySettings,
} from "@/features/prism/lib/governance-priority-settings"
import { dispatchRescore, RESCORE_EVENT } from "@/features/prism/lib/review-task-store"
import type { InboxSegment, ReviewInboxItem } from "@/features/prism/types/review-task"
import { usePullRequests } from "@/hooks/use-pull-requests"
import { fetchPullRequest } from "@/lib/api/pull-requests"

export type { InboxSegment }

type UseReviewInboxOptions = {
  segment?: InboxSegment
  reloadToken?: number
}

export function useReviewInbox(options: UseReviewInboxOptions = {}) {
  const { segment = "unread", reloadToken = 0 } = options
  const [settings, setSettings] = useState<PrioritySettings>(() => readPrioritySettings())
  const [metricsCache, setMetricsCache] = useState<Map<string, PrMetrics>>(() => new Map())
  const [attentionTick, setAttentionTick] = useState(0)

  const { items, loading, error, reload } = usePullRequests({
    includeExternal: "false",
    limit: "100",
    includeCounts: "false",
    state: "open",
  })

  useEffect(() => {
    if (reloadToken > 0) reload()
  }, [reloadToken, reload])

  useEffect(() => {
    const bumpAttention = () => {
      setSettings(readPrioritySettings())
      setAttentionTick((n) => n + 1)
    }
    const onSyncUpdated = () => {
      bumpAttention()
      reload()
    }
    window.addEventListener(RESCORE_EVENT, bumpAttention)
    window.addEventListener(ATTENTION_STATE_EVENT, bumpAttention)
    window.addEventListener(PR_SYNC_UPDATED_EVENT, onSyncUpdated)
    return () => {
      window.removeEventListener(RESCORE_EVENT, bumpAttention)
      window.removeEventListener(ATTENTION_STATE_EVENT, bumpAttention)
      window.removeEventListener(PR_SYNC_UPDATED_EVENT, onSyncUpdated)
    }
  }, [reload])

  const allItems = useMemo(() => {
    void attentionTick
    const ranked = computeInboxItems(items, { settings, metricsCache })
    return enrichTasksWithOpinion(ranked)
  }, [items, settings, metricsCache, attentionTick])

  const tasks = useMemo(
    () => filterInboxItems(allItems, segment),
    [allItems, segment],
  )

  const prefetchMetrics = useCallback(async (taskList: ReviewInboxItem[], signal?: AbortSignal) => {
    const needFetch = taskList
      .slice(0, 12)
      .filter((t) => t.branch === "—" || !t.hasRealFiles)
    if (needFetch.length === 0) return
    const results = await Promise.allSettled(
      needFetch.map((t) => fetchPullRequest(t.prId, signal)),
    )
    if (signal?.aborted) return
    setMetricsCache((prev) => {
      const next = new Map(prev)
      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          const pr = result.value
          next.set(needFetch[i]!.prId, {
            branch: pr.sourceBranch,
            filesChanged: pr.filesChanged,
          })
        }
      })
      return next
    })
  }, [])

  useEffect(() => {
    if (tasks.length === 0) return
    const ac = new AbortController()
    void prefetchMetrics(tasks, ac.signal)
    return () => ac.abort()
  }, [tasks, prefetchMetrics])

  return {
    tasks,
    allItems,
    loading,
    error,
    reload: () => {
      reload()
      dispatchRescore()
    },
  }
}

/** @deprecated Use useReviewInbox */
export function useReviewTasks(options: { reloadToken?: number } = {}) {
  return useReviewInbox({ segment: "all", reloadToken: options.reloadToken })
}

export type { PullRequestListItem, ReviewInboxItem }
