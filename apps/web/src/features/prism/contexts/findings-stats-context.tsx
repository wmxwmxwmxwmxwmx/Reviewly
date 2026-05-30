"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export interface FindingsStatsSnapshot {
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

const defaultStats: FindingsStatsSnapshot = {
  total: 0,
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
}

interface FindingsStatsContextValue {
  stats: FindingsStatsSnapshot
  setStats: (stats: FindingsStatsSnapshot) => void
}

const FindingsStatsContext = createContext<FindingsStatsContextValue | null>(null)

export function FindingsStatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStatsState] = useState<FindingsStatsSnapshot>(defaultStats)
  const setStats = useCallback((next: FindingsStatsSnapshot) => {
    setStatsState(next)
  }, [])
  const value = useMemo(() => ({ stats, setStats }), [stats, setStats])
  return (
    <FindingsStatsContext.Provider value={value}>{children}</FindingsStatsContext.Provider>
  )
}

export function useFindingsStats() {
  const ctx = useContext(FindingsStatsContext)
  if (!ctx) {
    throw new Error("useFindingsStats must be used within FindingsStatsProvider")
  }
  return ctx
}

export function useFindingsStatsOptional() {
  return useContext(FindingsStatsContext)
}
