"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Download, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react"

import type { ArchitectureEdge, ArchitectureGraph } from "@reviewly/shared"

import {
  computeNodeDegrees,
  expandHighlightWithNeighbors,
  filterEdgesForNodes,
  layoutTopologyNodes,
  resolveRiskHighlightIds,
  selectNodesForTopology,
  type RiskFocus,
  type TopologyNode,
} from "@/lib/architecture/graph-utils"
import { cn } from "@/lib/utils"

interface ArchitectureTopologyGraphProps {
  graph: ArchitectureGraph
  selectedNodeId: string | null
  riskFocus: RiskFocus
  onSelectNode: (id: string) => void
  securityCountByFile?: Map<string, number>
  className?: string
}

const VIEW_W = 960
const VIEW_H = 420

function edgePath(from: TopologyNode, to: TopologyNode): string {
  const mx = (from.x + to.x) / 2
  return `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`
}

export function ArchitectureTopologyGraph({
  graph,
  selectedNodeId,
  riskFocus,
  onSelectNode,
  securityCountByFile,
  className,
}: ArchitectureTopologyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)

  const highlightIds = useMemo(() => {
    const base = resolveRiskHighlightIds(graph, riskFocus)
    if (selectedNodeId) base.add(selectedNodeId)
    return expandHighlightWithNeighbors(base, graph.edges, 1)
  }, [graph, riskFocus, selectedNodeId])

  const degrees = useMemo(
    () => computeNodeDegrees(graph.nodes, graph.edges),
    [graph.nodes, graph.edges],
  )

  const { layoutNodes, visibleEdges, truncatedNote } = useMemo(() => {
    const selected = selectNodesForTopology(graph, degrees, highlightIds)
    const idSet = new Set(selected.map((n) => n.id))
    const layoutNodes = layoutTopologyNodes(selected, degrees, VIEW_W, VIEW_H)
    const visibleEdges = filterEdgesForNodes(graph.edges, idSet)
    const truncatedNote =
      graph.nodes.length > selected.length
        ? `展示 ${selected.length}/${graph.nodes.length} 个高度数/相关节点`
        : null
    return { layoutNodes, visibleEdges, truncatedNote }
  }, [graph, degrees, highlightIds])

  const layoutById = useMemo(() => {
    const m = new Map<string, TopologyNode>()
    layoutNodes.forEach((n) => m.set(n.id, n))
    return m
  }, [layoutNodes])

  const highlightedEdgeKeys = useMemo(() => {
    const keys = new Set<string>()
    if (riskFocus?.type === "layer" && graph.metrics) {
      const v = graph.metrics.layerViolations[riskFocus.index]
      if (v) keys.add(`${v.from}\0${v.to}`)
    }
    return keys
  }, [riskFocus, graph.metrics])

  const exportPng = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "architecture-graph.svg"
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const shell = (
    <div
      className={cn(
        "flex flex-col bg-surface-1",
        fullscreen && "fixed inset-4 z-50 rounded-lg border border-border shadow-2xl",
        className,
      )}
    >
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-surface-2">
        <span className="text-[10px] text-muted-foreground flex-1 truncate">
          {truncatedNote ?? `依赖拓扑 · ${layoutNodes.length} 节点 · ${visibleEdges.length} 边`}
        </span>
        <button
          type="button"
          title="缩小"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
          className="p-1 rounded hover:bg-surface-3 text-muted-foreground"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="放大"
          onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
          className="p-1 rounded hover:bg-surface-3 text-muted-foreground"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="导出 SVG"
          onClick={exportPng}
          className="p-1 rounded hover:bg-surface-3 text-muted-foreground"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title={fullscreen ? "退出全屏" : "全屏"}
          onClick={() => setFullscreen(!fullscreen)}
          className="p-1 rounded hover:bg-surface-3 text-muted-foreground"
        >
          {fullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <div className={cn("overflow-auto", fullscreen ? "flex-1 min-h-0" : "h-[320px]")}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full min-w-[640px]"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
        >
          <defs>
            <marker
              id="arch-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="oklch(0.55 0.05 264 / 0.6)" />
            </marker>
          </defs>
          {visibleEdges.map((e) => {
            const from = layoutById.get(e.from)
            const to = layoutById.get(e.to)
            if (!from || !to) return null
            const key = `${e.from}\0${e.to}`
            const emphasized =
              highlightedEdgeKeys.has(key) ||
              highlightIds.has(e.from) ||
              highlightIds.has(e.to)
            return (
              <path
                key={key}
                d={edgePath(from, to)}
                fill="none"
                stroke={emphasized ? "oklch(0.65 0.19 240)" : "oklch(0.4 0.02 264)"}
                strokeWidth={emphasized ? 1.5 : 0.75}
                strokeOpacity={emphasized ? 0.85 : 0.35}
                markerEnd="url(#arch-arrow)"
              />
            )
          })}
          {layoutNodes.map((n) => {
            const selected = selectedNodeId === n.id
            const inHighlight = highlightIds.has(n.id)
            const sec = securityCountByFile?.get(n.id) ?? 0
            const r = selected ? 7 : inHighlight ? 6 : 4 + Math.min(3, n.degree.total)
            return (
              <g
                key={n.id}
                className="cursor-pointer"
                onClick={() => onSelectNode(n.id)}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  className={cn(
                    selected && "fill-ai-blue stroke-ai-blue",
                    !selected && inHighlight && "fill-ai-blue/40 stroke-ai-blue",
                    !selected && !inHighlight && "fill-surface-3 stroke-border",
                  )}
                  strokeWidth={selected ? 2 : 1}
                />
                {sec > 0 && (
                  <circle cx={n.x + r} cy={n.y - r} r={3} className="fill-risk-high" />
                )}
                <title>
                  {n.id}
                  {`\n度: ${n.degree.in}↓ ${n.degree.out}↑`}
                  {sec > 0 ? `\n安全发现: ${sec}` : ""}
                </title>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )

  if (fullscreen) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setFullscreen(false)}
          aria-hidden
        />
        {shell}
      </>
    )
  }

  return shell
}

/** @deprecated Use ArchitectureTopologyGraph */
export function ArchitectureGraphViewer(props: {
  graph: ArchitectureGraph
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  riskFocus?: RiskFocus
  securityCountByFile?: Map<string, number>
}) {
  return (
    <ArchitectureTopologyGraph
      graph={props.graph}
      selectedNodeId={props.selectedNodeId}
      onSelectNode={props.onSelectNode}
      riskFocus={props.riskFocus ?? null}
      securityCountByFile={props.securityCountByFile}
    />
  )
}
