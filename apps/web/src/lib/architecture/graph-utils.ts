import type {
  ArchitectureEdge,
  ArchitectureGraph,
  ArchitectureNode,
  ArchitectureScanMetrics,
} from "@reviewly/shared"

export type ArchitectureSummaryExt = ArchitectureScanMetrics["summary"] & {
  truncated?: boolean
  filesDiscovered?: number
  edgesTruncated?: boolean
}

export type NodeDegree = {
  in: number
  out: number
  total: number
}

export type RiskFocus =
  | { type: "cycle"; index: number }
  | { type: "giant"; id: string }
  | { type: "layer"; index: number }
  | null

const LAYER_Y: Record<string, number> = {
  controller: 0,
  service: 1,
  repository: 2,
  module: 3,
}

export function extendSummary(metrics: ArchitectureScanMetrics | undefined): ArchitectureSummaryExt | undefined {
  return metrics?.summary as ArchitectureSummaryExt | undefined
}

export function computeNodeDegrees(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
): Map<string, NodeDegree> {
  const map = new Map<string, NodeDegree>()
  for (const n of nodes) {
    map.set(n.id, { in: 0, out: 0, total: 0 })
  }
  for (const e of edges) {
    const from = map.get(e.from)
    const to = map.get(e.to)
    if (from) {
      from.out += 1
      from.total += 1
    }
    if (to) {
      to.in += 1
      to.total += 1
    }
  }
  return map
}

export function computeArchitectureHealthScore(
  metrics: ArchitectureScanMetrics | undefined,
  summary: ArchitectureSummaryExt | undefined,
): number {
  if (!metrics?.summary) return 0
  let score = 100
  score -= Math.min(40, metrics.cycles.length * 8)
  score -= Math.min(25, metrics.giantModules.length * 3)
  score -= Math.min(25, metrics.layerViolations.length * 2)
  if (summary?.truncated) score -= 10
  if (summary?.edgesTruncated) score -= 5
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function healthScoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 75) return "good"
  if (score >= 50) return "warn"
  return "bad"
}

export function layerDistribution(nodes: ArchitectureNode[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const n of nodes) {
    const key = n.layer ?? "module"
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

export function resolveRiskHighlightIds(
  graph: ArchitectureGraph,
  focus: RiskFocus,
): Set<string> {
  const ids = new Set<string>()
  if (!focus || !graph.metrics) return ids

  if (focus.type === "cycle") {
    const cycle = graph.metrics.cycles[focus.index]
    if (cycle) cycle.forEach((id) => ids.add(id))
  } else if (focus.type === "giant") {
    ids.add(focus.id)
  } else if (focus.type === "layer") {
    const v = graph.metrics.layerViolations[focus.index]
    if (v) {
      ids.add(v.from)
      ids.add(v.to)
    }
  }
  return ids
}

export function expandHighlightWithNeighbors(
  highlight: Set<string>,
  edges: ArchitectureEdge[],
  hops = 1,
): Set<string> {
  const result = new Set(highlight)
  for (let h = 0; h < hops; h++) {
    const next = new Set<string>()
    for (const e of edges) {
      if (result.has(e.from)) next.add(e.to)
      if (result.has(e.to)) next.add(e.from)
    }
    next.forEach((id) => result.add(id))
  }
  return result
}

const TOPOLOGY_MAX_NODES = 180

export type TopologyNode = ArchitectureNode & {
  x: number
  y: number
  degree: NodeDegree
}

export function selectNodesForTopology(
  graph: ArchitectureGraph,
  degrees: Map<string, NodeDegree>,
  highlight: Set<string>,
): ArchitectureNode[] {
  const all = graph.nodes
  if (all.length <= TOPOLOGY_MAX_NODES) return all

  if (highlight.size > 0) {
    const expanded = expandHighlightWithNeighbors(highlight, graph.edges, 1)
    const picked = all.filter((n) => expanded.has(n.id))
    if (picked.length <= TOPOLOGY_MAX_NODES) return picked
    return picked
      .sort((a, b) => (degrees.get(b.id)?.total ?? 0) - (degrees.get(a.id)?.total ?? 0))
      .slice(0, TOPOLOGY_MAX_NODES)
  }

  return [...all]
    .sort((a, b) => (degrees.get(b.id)?.total ?? 0) - (degrees.get(a.id)?.total ?? 0))
    .slice(0, TOPOLOGY_MAX_NODES)
}

export function layoutTopologyNodes(
  nodes: ArchitectureNode[],
  degrees: Map<string, NodeDegree>,
  width: number,
  height: number,
): TopologyNode[] {
  const padding = 48
  const byLayer: Record<string, ArchitectureNode[]> = {
    controller: [],
    service: [],
    repository: [],
    module: [],
  }
  for (const n of nodes) {
    const layer = n.layer ?? "module"
    const key = layer in byLayer ? layer : "module"
    byLayer[key].push(n)
  }

  const layerKeys = ["controller", "service", "repository", "module"] as const
  const rowH = (height - padding * 2) / Math.max(layerKeys.length, 1)

  const positioned: TopologyNode[] = []
  layerKeys.forEach((layer, rowIdx) => {
    const row = byLayer[layer]
    const y = padding + rowIdx * rowH + rowH / 2
    const span = width - padding * 2
    row.forEach((n, i) => {
      const x =
        row.length === 1
          ? width / 2
          : padding + (span * (i + 1)) / (row.length + 1)
      positioned.push({
        ...n,
        x,
        y,
        degree: degrees.get(n.id) ?? { in: 0, out: 0, total: 0 },
      })
    })
  })

  return positioned
}

export function filterEdgesForNodes(
  edges: ArchitectureEdge[],
  nodeIds: Set<string>,
): ArchitectureEdge[] {
  return edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
}

export function formatScannedAt(iso: string | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function layerY(layer: string | undefined): number {
  return LAYER_Y[layer ?? "module"] ?? LAYER_Y.module
}
