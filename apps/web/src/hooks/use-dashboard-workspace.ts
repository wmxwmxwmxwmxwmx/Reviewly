"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type {
  AnalysisJobsStats,
  DashboardActivity,
  Repository,
  RepoReviewGroup,
} from "@reviewly/shared"

import {
  fetchAnalysisJobsStats,
  fetchRecentActivity,
  fetchWorkspaceRepos,
} from "@/lib/api/dashboard-workspace"
import { fetchReviewRepoGroups } from "@/lib/api/review-center"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { PrismApiError } from "@/lib/api/client"

const REFRESH_MS = 30_000

export interface DashboardWorkspaceData {
  stats: AnalysisJobsStats | null
  activities: DashboardActivity[]
  repoGroups: RepoReviewGroup[]
  repos: Repository[]
}

const EMPTY_STATS: AnalysisJobsStats = {
  pendingAssigned: 0,
  changesRequested: 0,
  highRisk: 0,
  approved: 0,
  weeklyAnalysisCount: 0,
}

export function useDashboardWorkspace() {
  const [data, setData] = useState<DashboardWorkspaceData>({
    stats: null,
    activities: [],
    repoGroups: [],
    repos: [],
  })
  const [loading, setLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const loadAbortRef = useRef<AbortController | null>(null)
  const requestSeqRef = useRef(0)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    loadAbortRef.current?.abort()
    const ac = new AbortController()
    loadAbortRef.current = ac
    const seq = ++requestSeqRef.current

    if (!opts?.silent) {
      setLoading(true)
    } else {
      setIsValidating(true)
    }
    setError(null)

    try {
      const [statsRes, activityRes, groupsRes, reposRes] = await Promise.all([
        fetchAnalysisJobsStats(ac.signal),
        fetchRecentActivity(15, ac.signal),
        fetchReviewRepoGroups(ac.signal),
        fetchWorkspaceRepos(ac.signal),
      ])

      if (!mounted.current || seq !== requestSeqRef.current) return

      setData({
        stats: statsRes,
        activities: activityRes.activities ?? [],
        repoGroups: groupsRes.groups ?? [],
        repos: reposRes ?? [],
      })
    } catch (e: unknown) {
      if (isAbortError(e)) return
      if (mounted.current && seq === requestSeqRef.current) {
        setError(e instanceof PrismApiError ? e.message : "加载工作台数据失败")
      }
    } finally {
      if (mounted.current && seq === requestSeqRef.current && shouldApplyResult(ac.signal)) {
        setLoading(false)
        setIsValidating(false)
      }
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void load()
    const timer = window.setInterval(() => void load({ silent: true }), REFRESH_MS)
    return () => {
      mounted.current = false
      window.clearInterval(timer)
      loadAbortRef.current?.abort()
    }
  }, [load])

  const stats = useMemo(() => data.stats ?? EMPTY_STATS, [data.stats])

  return {
    stats,
    activities: data.activities,
    repoGroups: data.repoGroups,
    repos: data.repos,
    loading,
    isValidating,
    error,
    refetch: () => load({ silent: true }),
  }
}
