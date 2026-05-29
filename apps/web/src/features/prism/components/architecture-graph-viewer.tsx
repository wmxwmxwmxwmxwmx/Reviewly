"use client"

import { useMemo } from "react"

import { cn } from "@/lib/utils"
import type { ArchitectureGraph } from "@/lib/api/architecture"

const LAYERS = ["controller", "service", "repository", "module"] as const

interface ArchitectureGraphViewerProps {
  graph: ArchitectureGraph
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
}

export function ArchitectureGraphViewer({
  graph,
  selectedNodeId,
  onSelectNode,
}: ArchitectureGraphViewerProps) {
  const layout = useMemo(() => {
    const columns: Record<string, { id: string; label: string }[]> = {
      controller: [],
      service: [],
      repository: [],
      module: [],
    }
    for (const node of graph.nodes) {
      const layer = (node.layer ?? "module") as (typeof LAYERS)[number]
      const key = LAYERS.includes(layer) ? layer : "module"
      columns[key].push({ id: node.id, label: node.label })
    }
    return columns
  }, [graph.nodes])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3 bg-surface-1 min-h-[140px]">
      {LAYERS.map((layer) => (
        <div key={layer} className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1">
            {layer}
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {layout[layer].map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                className={cn(
                  "w-full text-left text-[10px] font-mono px-2 py-1 rounded border truncate",
                  selectedNodeId === node.id
                    ? "border-ai-blue bg-ai-blue/15 text-foreground"
                    : "border-border bg-surface-2 text-muted-foreground hover:border-ai-blue/50",
                )}
                title={node.id}
              >
                {node.label}
              </button>
            ))}
            {layout[layer].length === 0 && (
              <span className="text-[10px] text-muted-foreground px-1">—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
