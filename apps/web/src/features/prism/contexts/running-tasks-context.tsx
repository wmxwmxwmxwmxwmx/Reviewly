"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type RunningTaskModule =
  | "pullRequests"
  | "aiReview"
  | "security"
  | "governance"
  | "performance"

export type RunningTaskCounts = Record<RunningTaskModule, number>

const zeroCounts = (): RunningTaskCounts => ({
  pullRequests: 0,
  aiReview: 0,
  security: 0,
  governance: 0,
  performance: 0,
})

interface RunningTasksContextValue {
  counts: RunningTaskCounts
  increment: (module: RunningTaskModule) => void
  decrement: (module: RunningTaskModule) => void
}

const RunningTasksContext = createContext<RunningTasksContextValue | null>(null)

export function RunningTasksProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<RunningTaskCounts>(zeroCounts)

  const increment = useCallback((module: RunningTaskModule) => {
    setCounts((prev) => ({ ...prev, [module]: prev[module] + 1 }))
  }, [])

  const decrement = useCallback((module: RunningTaskModule) => {
    setCounts((prev) => ({
      ...prev,
      [module]: Math.max(0, prev[module] - 1),
    }))
  }, [])

  const value = useMemo(
    () => ({ counts, increment, decrement }),
    [counts, increment, decrement],
  )

  return (
    <RunningTasksContext.Provider value={value}>{children}</RunningTasksContext.Provider>
  )
}

export function useRunningTasksStore() {
  const ctx = useContext(RunningTasksContext)
  if (!ctx) {
    throw new Error("useRunningTasksStore must be used within RunningTasksProvider")
  }
  return ctx.counts
}

export function useRunningTask(module: RunningTaskModule, active: boolean) {
  const ctx = useContext(RunningTasksContext)
  if (!ctx) {
    throw new Error("useRunningTask must be used within RunningTasksProvider")
  }

  const { increment, decrement } = ctx

  useEffect(() => {
    if (!active) return
    increment(module)
    return () => decrement(module)
  }, [module, active, increment, decrement])
}
