"use client"

import { useMemo, useState } from "react"
import { Search, Shield } from "lucide-react"

import type { ArchitectureEdge, ArchitectureGraph, ArchitectureNode } from "@reviewly/shared"

import { computeNodeDegrees } from "@/lib/architecture/graph-utils"
import { cn } from "@/lib/utils"
import { zh } from "@/lib/i18n/zh"

type SortKey = "degree" | "lines" | "imports" | "name"

interface ArchitectureModuleExplorerProps {
  graph: ArchitectureGraph
  selectedNodeId: string | null
  selectedNode: ArchitectureNode | null
  inbound: ArchitectureEdge[]
  outbound: ArchitectureEdge[]
  onSelectNode: (id: string | null) => void
  securityCountByFile?: Map<string, number>
}

export function ArchitectureModuleExplorer({
  graph,
  selectedNodeId,
  selectedNode,
  inbound,
  outbound,
  onSelectNode,
  securityCountByFile,
}: ArchitectureModuleExplorerProps) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("degree")
  const [layerFilter, setLayerFilter] = useState("")

  const degrees = useMemo(
    () => computeNodeDegrees(graph.nodes, graph.edges),
    [graph.nodes, graph.edges],
  )

  const layers = useMemo(() => {
    const s = new Set<string>()
    graph.nodes.forEach((n) => s.add(n.layer ?? "module"))
    return Array.from(s).sort()
  }, [graph.nodes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = graph.nodes.filter((n) => {
      if (layerFilter && (n.layer ?? "module") !== layerFilter) return false
      if (!q) return true
      return (
        n.id.toLowerCase().includes(q) ||
        n.label.toLowerCase().includes(q) ||
        (n.path?.toLowerCase().includes(q) ?? false)
      )
    })
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.id.localeCompare(b.id)
      if (sort === "lines") return (b.lines ?? 0) - (a.lines ?? 0)
      if (sort === "imports") return (b.importCount ?? 0) - (a.importCount ?? 0)
      const da = degrees.get(a.id)?.total ?? 0
      const db = degrees.get(b.id)?.total ?? 0
      return db - da
    })
    return list.slice(0, 200)
  }, [graph.nodes, query, layerFilter, sort, degrees])

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-surface-2 flex flex-col h-full min-h-[280px]">
      <div className="px-3 py-2 border-b border-border space-y-2">
        <p className="text-xs font-medium text-foreground">模块浏览器</p>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索路径或文件名…"
            className="w-full h-7 pl-7 pr-2 text-[10px] bg-background border border-border rounded-md"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <select
            value={layerFilter}
            onChange={(e) => setLayerFilter(e.target.value)}
            className="h-6 text-[10px] px-1 rounded border border-border bg-background"
          >
            <option value="">全部分层</option>
            {layers.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-6 text-[10px] px-1 rounded border border-border bg-background"
          >
            <option value="degree">按耦合度</option>
            <option value="lines">按行数</option>
            <option value="imports">按 import 数</option>
            <option value="name">按名称</option>
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 min-h-0 divide-y divide-border lg:divide-y-0 lg:grid-cols-2 lg:divide-x">
        <div className="overflow-y-auto max-h-48 lg:max-h-none">
          {filtered.map((n) => {
            const deg = degrees.get(n.id)
            const sec = securityCountByFile?.get(n.id) ?? 0
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelectNode(n.id)}
                className={cn(
                  "w-full text-left px-2 py-1.5 border-b border-border/50 text-[10px] hover:bg-surface-3",
                  selectedNodeId === n.id && "bg-ai-blue/10",
                )}
              >
                <div className="flex items-center gap-1">
                  <span className="font-mono text-foreground truncate flex-1">{n.label}</span>
                  {sec > 0 && <Shield className="w-3 h-3 text-risk-high shrink-0" />}
                  <span className="text-muted-foreground shrink-0">{n.layer}</span>
                </div>
                <p className="text-muted-foreground truncate font-mono">{n.id}</p>
                <p className="text-muted-foreground">
                  度 {deg?.total ?? 0} · {n.lines ?? 0} 行 · imp {n.importCount ?? 0}
                </p>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="p-3 text-[10px] text-muted-foreground">无匹配模块</p>
          )}
        </div>

        <div className="p-3 overflow-y-auto text-xs">
          <p className="text-[10px] text-muted-foreground mb-2">{zh.architecture.moduleDetail}</p>
          {selectedNode ? (
            <div className="space-y-2">
              <div>
                <span className="text-muted-foreground">{zh.architecture.path} </span>
                <span className="font-mono text-foreground break-all">
                  {selectedNode.path ?? selectedNode.id}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span>
                  {zh.architecture.language} {selectedNode.language ?? "—"}
                </span>
                <span>
                  {zh.architecture.layer} {selectedNode.layer ?? "—"}
                </span>
                <span>
                  {zh.architecture.lines} {selectedNode.lines ?? "—"}
                </span>
                <span>import {selectedNode.importCount ?? 0}</span>
                <span>
                  度 {(degrees.get(selectedNode.id)?.total ?? 0)}
                  （↓{degrees.get(selectedNode.id)?.in ?? 0} ↑
                  {degrees.get(selectedNode.id)?.out ?? 0}）
                </span>
                {(securityCountByFile?.get(selectedNode.id) ?? 0) > 0 && (
                  <span className="text-risk-high flex items-center gap-0.5">
                    <Shield className="w-3 h-3" />
                    安全发现 {securityCountByFile?.get(selectedNode.id)}
                  </span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {zh.architecture.inboundEdges} ({inbound.length})
                </span>
                <ul className="mt-1 font-mono text-[10px] text-muted-foreground max-h-20 overflow-y-auto">
                  {inbound.map((e) => (
                    <li key={`${e.from}-${e.to}`}>
                      <button
                        type="button"
                        className="hover:text-ai-blue text-left"
                        onClick={() => onSelectNode(e.from)}
                      >
                        {e.from}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {zh.architecture.outboundEdges} ({outbound.length})
                </span>
                <ul className="mt-1 font-mono text-[10px] text-muted-foreground max-h-20 overflow-y-auto">
                  {outbound.map((e) => (
                    <li key={`${e.from}-${e.to}`}>
                      <button
                        type="button"
                        className="hover:text-ai-blue text-left"
                        onClick={() => onSelectNode(e.to)}
                      >
                        {e.to}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-[10px]">{zh.architecture.clickNodeHint}</p>
          )}
        </div>
      </div>
    </div>
  )
}
