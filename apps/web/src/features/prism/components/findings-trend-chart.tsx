"use client"

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { zh } from "@/lib/i18n/zh"

interface TrendPoint {
  date: string
  count: number
}

interface FindingsTrendChartProps {
  title: string
  data: TrendPoint[]
}

export function FindingsTrendChart({ title, data }: FindingsTrendChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 h-[180px] flex flex-col">
        <p className="text-xs font-medium text-foreground mb-2">{title}</p>
        <p className="text-xs text-muted-foreground m-auto">{zh.findings.noTrend}</p>
      </div>
    )
  }

  const chartData = data.map((p) => ({
    ...p,
    label: p.date.slice(5),
  }))

  return (
    <div className="rounded-lg border border-border bg-card p-4 h-[180px]">
      <p className="text-xs font-medium text-foreground mb-2">{title}</p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.65 0 0)" }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "oklch(0.65 0 0)" }} />
          <Tooltip
            contentStyle={{
              background: "oklch(0.15 0 0)",
              border: "1px solid oklch(0.25 0 0)",
              borderRadius: 6,
              fontSize: 11,
            }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
          />
          <Bar dataKey="count" fill="oklch(0.72 0.14 230)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
