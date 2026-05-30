"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import { useDashboard } from "@/hooks/use-dashboard"

type DashboardContextValue = ReturnType<typeof useDashboard>

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const dashboard = useDashboard()
  const value = useMemo(
    () => dashboard,
    [
      dashboard.data,
      dashboard.loading,
      dashboard.isValidating,
      dashboard.error,
      dashboard.refetch,
    ],
  )
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboardContext() {
  const ctx = useContext(DashboardContext)
  if (!ctx) {
    throw new Error("useDashboardContext must be used within DashboardProvider")
  }
  return ctx
}
