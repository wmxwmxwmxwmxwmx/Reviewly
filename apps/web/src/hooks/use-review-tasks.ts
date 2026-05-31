"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { PullRequestListItem } from "@reviewly/shared"

import {
  computePriority,
  filterTasksByQueue,
  getNextInboxTask,
  shouldShowInInbox,
  type PrMetrics,
} from "@/features/prism/ai/priority-ranker"
import { enrichTasksWithOpinion } from "@/features/prism/lib/review-task-verdict"
import {
  readPrioritySettings,
  type PrioritySettings,
} from "@/features/prism/lib/governance-priority-settings"
import {
  clearDeferred,
  clearPrOverrides,
  deferPr,
  dismissPr,
  dispatchRescore,
  readStore,
  returnToInbox,
  restoreAllDone,
  RESCORE_EVENT,
  type ReviewTaskStoreSnapshot,
} from "@/features/prism/lib/review-task-store"
import type { ReviewTask, ReviewTaskQueue } from "@/features/prism/types/review-task"
import { usePullRequests } from "@/hooks/use-pull-requests"
import { fetchPullRequest } from "@/lib/api/pull-requests"

type UseReviewTasksOptions = {
  queue?: ReviewTaskQueue
  reloadToken?: number
}

export function useReviewTasks(options: UseReviewTasksOptions = {}) {
  const { queue, reloadToken = 0 } = options
  const [store, setStore] = useState<ReviewTaskStoreSnapshot>(() => readStore())
  const [settings, setSettings] = useState<PrioritySettings>(() => readPrioritySettings())
  const [metricsCache, setMetricsCache] = useState<Map<string, PrMetrics>>(() => new Map())
  const [rescoreTick, setRescoreTick] = useState(0)

  const { items, loading, error, reload } = usePullRequests({
    includeExternal: "true",
    limit: "100",
    includeCounts: "false",
  })

  useEffect(() => {
    if (reloadToken > 0) reload()
  }, [reloadToken, reload])

  useEffect(() => {
    const onRescore = () => {
      setStore(readStore())
      setSettings(readPrioritySettings())
      setRescoreTick((n) => n + 1)
      reload()
    }
    window.addEventListener(RESCORE_EVENT, onRescore)
    return () => window.removeEventListener(RESCORE_EVENT, onRescore)
  }, [reload])

  const allTasks = useMemo(() => {
    void rescoreTick
    const ranked = computePriority(items, { settings, store, metricsCache })
    return enrichTasksWithOpinion(ranked, store)
  }, [items, settings, store, metricsCache, rescoreTick])

  const tasks = useMemo(() => {
    if (!queue) return allTasks
    if (queue === "inbox") {
      return filterTasksByQueue(allTasks, "inbox").filter((t) => shouldShowInInbox(t, store))
    }
    return filterTasksByQueue(allTasks, queue)
  }, [allTasks, queue, store])

  const refreshStore = useCallback(() => {
    setStore(readStore())
    setSettings(readPrioritySettings())
  }, [])

  const handleDefer = useCallback((prId: string) => {
    setStore(deferPr(prId))
  }, [])

  const handleReturnToInbox = useCallback((prId: string) => {
    setStore(returnToInbox(prId))
  }, [])

  const handleDismiss = useCallback((prId: string) => {
    setStore(dismissPr(prId))
  }, [])

  const handleClearOverrides = useCallback((prId: string) => {
    setStore(clearPrOverrides(prId))
  }, [])

  const handleClearDeferred = useCallback(() => {
    setStore(clearDeferred())
    dispatchRescore()
  }, [])

  const handleRestoreAllDone = useCallback(() => {
    const doneIds = allTasks.filter((t) => t.queue === "done").map((t) => t.prId)
    setStore(restoreAllDone(doneIds))
    dispatchRescore()
  }, [allTasks])

  const getNextInbox = useCallback(
    (currentPrId: string | null) => getNextInboxTask(allTasks, currentPrId, store),
    [allTasks, store],
  )

  const prefetchMetrics = useCallback(async (taskList: ReviewTask[]) => {
    const needFetch = taskList
      .slice(0, 12)
      .filter((t) => t.branch === "—" || !t.hasRealFiles)
    if (needFetch.length === 0) return
    const results = await Promise.allSettled(needFetch.map((t) => fetchPullRequest(t.prId)))
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
    if (tasks.length > 0) void prefetchMetrics(tasks)
  }, [tasks, prefetchMetrics])

  return {
    tasks,
    allTasks,
    loading,
    error,
    reload,
    store,
    settings,
    refreshStore,
    defer: handleDefer,
    returnToInbox: handleReturnToInbox,
    dismiss: handleDismiss,
    clearOverrides: handleClearOverrides,
    clearDeferred: handleClearDeferred,
    restoreAllDone: handleRestoreAllDone,
    getNextInbox,
  }
}

export type { PullRequestListItem }
