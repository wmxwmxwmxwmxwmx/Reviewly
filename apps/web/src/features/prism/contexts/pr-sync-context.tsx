"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useAuth } from "@/features/prism/contexts/auth-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { isAbortError } from "@/lib/abort-utils"
import { syncManagedPullRequests, type PrSyncTrigger } from "@/lib/api/repos"
import { withPrSyncMutex } from "@/lib/pr-sync-mutex"
import { dispatchPrSyncUpdated } from "@/lib/pr-sync-events"

const SYNC_INTERVAL_MS = 90_000
const FOCUS_DEBOUNCE_MS = 60_000

type PrSyncContextValue = {
  syncing: boolean
  lastSyncedAt: string | null
  syncNow: (trigger?: PrSyncTrigger) => Promise<void>
}

const PrSyncContext = createContext<PrSyncContextValue | null>(null)

export function PrSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { refresh: refreshRepos } = useReposStore()
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const syncingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const lastFocusRef = useRef(0)
  const syncNowRef = useRef<(trigger?: PrSyncTrigger) => Promise<void>>(async () => {})

  const runSync = useCallback(
    async (trigger: PrSyncTrigger = "manual") => {
      if (!isAuthenticated) return
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return
      }
      if (syncingRef.current) return

      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      syncingRef.current = true
      setSyncing(true)

      try {
        const stats = await withPrSyncMutex(() =>
          syncManagedPullRequests({ signal: ac.signal, trigger }),
        )
        if (ac.signal.aborted || stats === undefined) return
        const at = new Date().toISOString()
        setLastSyncedAt(at)
        await refreshRepos()
        dispatchPrSyncUpdated({
          at,
          stats: {
            synced: stats.synced,
            created: stats.created,
            updated: stats.updated,
            closed: stats.closed,
            repos: stats.repos,
          },
        })
      } catch (error) {
        if (!isAbortError(error) && !ac.signal.aborted) {
          console.warn("[PrSync] managed sync failed", error)
        }
      } finally {
        if (abortRef.current === ac) {
          syncingRef.current = false
          setSyncing(false)
        }
      }
    },
    [isAuthenticated, refreshRepos],
  )

  syncNowRef.current = runSync

  useEffect(() => {
    if (!isAuthenticated) return

    const runInitial = window.setTimeout(() => {
      void syncNowRef.current("focus")
    }, 2_000)

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncNowRef.current("interval")
      }
    }, SYNC_INTERVAL_MS)

    const onFocus = () => {
      const now = Date.now()
      if (now - lastFocusRef.current < FOCUS_DEBOUNCE_MS) return
      lastFocusRef.current = now
      if (document.visibilityState === "visible") {
        void syncNowRef.current("focus")
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncNowRef.current("focus")
      }
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.clearTimeout(runInitial)
      window.clearInterval(intervalId)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
      abortRef.current?.abort()
    }
  }, [isAuthenticated])

  const value = useMemo(
    () => ({ syncing, lastSyncedAt, syncNow: runSync }),
    [syncing, lastSyncedAt, runSync],
  )

  return <PrSyncContext.Provider value={value}>{children}</PrSyncContext.Provider>
}

export function useGlobalPrSync(): PrSyncContextValue {
  const ctx = useContext(PrSyncContext)
  if (!ctx) {
    throw new Error("useGlobalPrSync must be used within PrSyncProvider")
  }
  return ctx
}

export function usePrSyncState(): PrSyncContextValue {
  return useGlobalPrSync()
}

/** Safe hook when provider may be absent (fallback loop only). */
export function useOptionalPrSyncState(): PrSyncContextValue | null {
  return useContext(PrSyncContext)
}
