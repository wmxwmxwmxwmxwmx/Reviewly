"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"

import type { ArchitectureGraph } from "@reviewly/shared"

import type { RiskFocus } from "@/lib/architecture/graph-utils"
import { cn } from "@/lib/utils"
import { zh } from "@/lib/i18n/zh"

type RiskTab = "all" | "cycles" | "giants" | "layers"

interface ArchitectureRisksPanelProps {
  graph: ArchitectureGraph
  riskFocus: RiskFocus
  onRiskFocus: (focus: RiskFocus) => void
  onSelectNode: (nodeId: string) => void
  defaultOpen?: boolean
}

function severityClass(kind: "critical" | "high" | "medium") {
  if (kind === "critical") return "text-risk-high border-risk-high/40 bg-risk-high/10"
  if (kind === "high") return "text-amber-400 border-amber-400/40 bg-amber-400/10"
  return "text-muted-foreground border-border bg-surface-2"
}

export function ArchitectureRisksPanel({
  graph,
  riskFocus,
  onRiskFocus,
  onSelectNode,
  defaultOpen = true,
}: ArchitectureRisksPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState<RiskTab>("all")

  const metrics = graph.metrics
  const cycles = metrics?.cycles ?? []
  const giants = metrics?.giantModules ?? []
  const layers = metrics?.layerViolations ?? []
  const total = cycles.length + giants.length + layers.length

  const tabs = useMemo(
    () =>
      [
        { id: "all" as const, label: "全部", count: total },
        { id: "cycles" as const, label: zh.architecture.cycles, count: cycles.length },
        { id: "giants" as const, label: zh.architecture.giantModules, count: giants.length },
        { id: "layers" as const, label: "分层违规", count: layers.length },
      ].filter((t) => t.id === "all" || t.count > 0),
    [total, cycles.length, giants.length, layers.length],
  )

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
        未检测到架构风险项
      </div>
    )
  }

  const showCycles = tab === "all" || tab === "cycles"
  const showGiants = tab === "all" || tab === "giants"
  const showLayers = tab === "all" || tab === "layers"

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-3"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <AlertTriangle className="w-3.5 h-3.5 text-risk-high" />
        架构风险
        <span className="ml-auto text-muted-foreground font-normal">{total} 项</span>
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="flex flex-wrap gap-1 p-2 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] border",
                  tab === t.id
                    ? "border-ai-blue text-ai-blue bg-ai-blue/10"
                    : "border-border text-muted-foreground",
                )}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-border">
            {showCycles &&
              cycles.map((cycle, idx) => {
                const active =
                  riskFocus?.type === "cycle" && riskFocus.index === idx
                const path = cycle.filter((id, i, arr) => arr.indexOf(id) === i).join(" → ")
                return (
                  <button
                    key={`cycle-${idx}`}
                    type="button"
                    onClick={() => {
                      onRiskFocus(active ? null : { type: "cycle", index: idx })
                      if (cycle[0]) onSelectNode(cycle[0])
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-[10px] hover:bg-surface-3",
                      active && "bg-ai-blue/10",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block px-1 rounded border mb-1",
                        severityClass("critical"),
                      )}
                    >
                      循环依赖
                    </span>
                    <p className="font-mono text-muted-foreground break-all">{path}</p>
                  </button>
                )
              })}

            {showGiants &&
              giants.map((g) => {
                const active = riskFocus?.type === "giant" && riskFocus.id === g.id
                return (
                  <button
                    key={`giant-${g.id}`}
                    type="button"
                    onClick={() => {
                      onRiskFocus(active ? null : { type: "giant", id: g.id })
                      onSelectNode(g.id)
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-[10px] hover:bg-surface-3",
                      active && "bg-ai-blue/10",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block px-1 rounded border mb-1",
                        severityClass("medium"),
                      )}
                    >
                      巨型模块
                    </span>
                    <p className="font-mono text-foreground truncate">{g.path}</p>
                    <p className="text-muted-foreground">
                      {g.lines} 行 · import {g.importCount}
                    </p>
                  </button>
                )
              })}

            {showLayers &&
              layers.map((v, idx) => {
                const active = riskFocus?.type === "layer" && riskFocus.index === idx
                return (
                  <button
                    key={`layer-${idx}`}
                    type="button"
                    onClick={() => {
                      onRiskFocus(active ? null : { type: "layer", index: idx })
                      onSelectNode(v.from)
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-[10px] hover:bg-surface-3",
                      active && "bg-ai-blue/10",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block px-1 rounded border mb-1",
                        severityClass("high"),
                      )}
                    >
                      分层违规
                    </span>
                    <p className="font-mono text-foreground truncate">
                      {v.from} → {v.to}
                    </p>
                    <p className="text-muted-foreground">{v.reason}</p>
                  </button>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
