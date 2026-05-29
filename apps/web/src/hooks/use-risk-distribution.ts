"use client"

import { useMemo } from "react"

import type { DashboardStats } from "@reviewly/shared"

const LEVEL_ORDER = ["critical", "high", "medium", "low"] as const
const LEVEL_LABELS: Record<string, string> = {
  critical: "临界",
  high: "高",
  medium: "中",
  low: "低",
}

export interface RiskBarSegment {
  key: string
  label: string
  count: number
  percent: number
  colorClass: string
}

const COLOR: Record<string, string> = {
  critical: "bg-risk-high",
  high: "bg-risk-high",
  medium: "bg-risk-medium",
  low: "bg-risk-low",
}

export function useRiskDistribution(dashboard: DashboardStats | null) {
  return useMemo(() => {
    const dist = dashboard?.riskDistribution ?? {}
    const total = Object.values(dist).reduce((a, b) => a + b, 0)
    if (total === 0) return { segments: [] as RiskBarSegment[], total: 0 }

    const segments: RiskBarSegment[] = LEVEL_ORDER.filter((k) => (dist[k] ?? 0) > 0).map(
      (key) => {
        const count = dist[key] ?? 0
        return {
          key,
          label: LEVEL_LABELS[key] ?? key,
          count,
          percent: Math.round((count / total) * 100),
          colorClass: COLOR[key] ?? "bg-muted",
        }
      }
    )
    return { segments, total }
  }, [dashboard?.riskDistribution])
}
