"use client"

import { useMemo } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { ArchitectureNode, ArchitectureScanMetrics } from "@reviewly/shared"

import { layerDistribution } from "@/lib/architecture/graph-utils"

interface ArchitectureDistributionChartsProps {
  nodes: ArchitectureNode[]
  metrics: ArchitectureScanMetrics | undefined
}

const CHART_COLORS = ["var(--color-ai-blue)", "var(--color-ai-purple)", "#94a3b8", "#64748b"]

export function ArchitectureDistributionCharts({
  nodes,
  metrics,
}: ArchitectureDistributionChartsProps) {
  const langData = useMemo(() => {
    const langs = metrics?.summary.languages ?? {}
    return Object.entries(langs)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [metrics?.summary.languages])

  const layerData = useMemo(() => {
    const dist = layerDistribution(nodes)
    return Object.entries(dist)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [nodes])

  if (langData.length === 0 && layerData.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {langData.length > 0 && (
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            语言分布
          </p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={langData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.15 0.01 264)",
                    border: "1px solid oklch(0.28 0.01 264)",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {layerData.length > 0 && (
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            分层分布
          </p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={layerData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.15 0.01 264)",
                    border: "1px solid oklch(0.28 0.01 264)",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="count" fill={CHART_COLORS[1]} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
