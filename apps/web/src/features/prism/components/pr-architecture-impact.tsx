"use client"

import { useEffect, useMemo, useState } from "react"
import { GitBranch, Layers, Loader2, Network } from "lucide-react"

import type { ArchitectureGraph, DiffFile } from "@reviewly/shared"

import { fetchArchitectureGraph } from "@/lib/api/architecture"
import {
  computeArchitectureHealthScore,
  extendSummary,
  healthScoreTone,
} from "@/lib/architecture/graph-utils"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase()
}

function nodeMatchesFile(nodePath: string | undefined, nodeId: string, changed: string): string | null {
  const c = normalizePath(changed)
  const candidates = [nodePath, nodeId, nodeId.split("/").pop()].filter(Boolean) as string[]
  for (const raw of candidates) {
    const n = normalizePath(raw)
    if (n === c || c.endsWith(n) || n.endsWith(c)) return nodeId
  }
  return null
}

export function computePrArchitectureImpact(
  graph: ArchitectureGraph | null,
  diffFiles: DiffFile[],
) {
  if (!graph?.nodes?.length || !diffFiles.length) {
    return null
  }

  const changedPaths = diffFiles.map((f) => f.path)
  const affectedIds = new Set<string>()
  for (const file of changedPaths) {
    for (const node of graph.nodes) {
      const hit = nodeMatchesFile(node.path, node.id, file)
      if (hit) affectedIds.add(hit)
    }
  }

  const affectedNodes = graph.nodes.filter((n) => affectedIds.has(n.id))
  const layers = [...new Set(affectedNodes.map((n) => n.layer).filter(Boolean))] as string[]

  const relatedEdges = (graph.edges ?? []).filter(
    (e) => affectedIds.has(e.from) || affectedIds.has(e.to),
  )

  const metrics = graph.metrics
  const touchedCycles =
    metrics?.cycles?.filter((cycle) => cycle.some((id) => affectedIds.has(id))) ?? []
  const touchedGiants = metrics?.giantModules?.filter((g) => affectedIds.has(g.id)) ?? []
  const touchedLayerViolations =
    metrics?.layerViolations?.filter(
      (v) => affectedIds.has(v.from) || affectedIds.has(v.to),
    ) ?? []

  const summary = extendSummary(metrics)
  let impactScore = Math.min(
    100,
    affectedNodes.length * 12 +
      relatedEdges.length * 3 +
      touchedCycles.length * 15 +
      touchedLayerViolations.length * 10,
  )
  if (affectedNodes.length === 0) impactScore = 0
  const health = computeArchitectureHealthScore(metrics, summary)

  return {
    impactScore,
    health,
    affectedNodes,
    layers,
    relatedEdges,
    touchedCycles,
    touchedGiants,
    touchedLayerViolations,
    changedCount: changedPaths.length,
  }
}

interface PrArchitectureImpactProps {
  repoId: string | null | undefined
  diffFiles: DiffFile[]
  loadingDiff?: boolean
  onOpenArchitecture?: () => void
}

export function PrArchitectureImpact({
  repoId,
  diffFiles,
  loadingDiff,
  onOpenArchitecture,
}: PrArchitectureImpactProps) {
  const [graph, setGraph] = useState<ArchitectureGraph | null>(null)
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!repoId) {
      setGraph(null)
      return
    }
    const ac = new AbortController()
    setLoadingGraph(true)
    setError(null)
    fetchArchitectureGraph(repoId, ac.signal)
      .then(setGraph)
      .catch(() => setError("架构图加载失败"))
      .finally(() => {
        if (!ac.signal.aborted) setLoadingGraph(false)
      })
    return () => ac.abort()
  }, [repoId])

  const impact = useMemo(
    () => computePrArchitectureImpact(graph, diffFiles),
    [graph, diffFiles],
  )

  const loading = loadingDiff || loadingGraph

  if (!repoId) return null

  const tone = impact ? healthScoreTone(impact.health) : "warn"

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
        <Network className="w-4 h-4 text-ai-purple" />
        <span className="text-sm font-medium text-foreground">架构影响</span>
        {onOpenArchitecture && (
          <button
            type="button"
            onClick={onOpenArchitecture}
            className="ml-auto text-[11px] text-ai-blue hover:underline"
          >
            查看仓库架构
          </button>
        )}
      </div>
      <div className="p-4 space-y-3 text-xs">
        {loading && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {zh.common.loading}
          </p>
        )}
        {error && <p className="text-risk-high">{error}</p>}
        {!loading && !impact && (
          <p className="text-muted-foreground">
            {diffFiles.length === 0
              ? "暂无变更文件，无法评估架构影响"
              : "仓库尚未生成架构图，请先在架构分析中扫描仓库"}
          </p>
        )}
        {impact && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-muted-foreground">影响评分</p>
                <p className="text-lg font-semibold text-foreground">{impact.impactScore}</p>
              </div>
              <div>
                <p className="text-muted-foreground">仓库健康分</p>
                <p
                  className={cn(
                    "text-lg font-semibold",
                    tone === "good" && "text-risk-low",
                    tone === "warn" && "text-risk-medium",
                    tone === "bad" && "text-risk-high",
                  )}
                >
                  {impact.health}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">变更文件</p>
                <p className="text-lg font-semibold">{impact.changedCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">受影响模块</p>
                <p className="text-lg font-semibold">{impact.affectedNodes.length}</p>
              </div>
            </div>

            {impact.layers.length > 0 && (
              <div className="flex items-start gap-2">
                <Layers className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground mb-1">受影响层级</p>
                  <p className="text-foreground">{impact.layers.join(" · ")}</p>
                </div>
              </div>
            )}

            {impact.affectedNodes.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1">模块</p>
                <ul className="space-y-0.5 max-h-24 overflow-y-auto font-mono text-[11px]">
                  {impact.affectedNodes.slice(0, 12).map((n) => (
                    <li key={n.id} className="text-foreground truncate">
                      {n.label || n.id}
                    </li>
                  ))}
                  {impact.affectedNodes.length > 12 && (
                    <li className="text-muted-foreground">
                      另有 {impact.affectedNodes.length - 12} 个…
                    </li>
                  )}
                </ul>
              </div>
            )}

            {impact.relatedEdges.length > 0 && (
              <div className="flex items-start gap-2">
                <GitBranch className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                <p className="text-muted-foreground">
                  相关依赖边 {impact.relatedEdges.length} 条
                </p>
              </div>
            )}

            {impact.touchedCycles.length > 0 && (
              <p className="text-risk-high">
                触及 {impact.touchedCycles.length} 处循环依赖
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
