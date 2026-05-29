"use client"

import { useMemo, useState } from "react"

import type { ArchitectureEdge, ArchitectureGraph, ArchitectureNode } from "@/lib/api/architecture"

export function useArchitectureSelection(graph: ArchitectureGraph | null) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const selectedNode: ArchitectureNode | null = useMemo(() => {
    if (!graph || !selectedNodeId) return null
    return graph.nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [graph, selectedNodeId])

  const inbound: ArchitectureEdge[] = useMemo(() => {
    if (!graph || !selectedNodeId) return []
    return graph.edges.filter((e) => e.to === selectedNodeId)
  }, [graph, selectedNodeId])

  const outbound: ArchitectureEdge[] = useMemo(() => {
    if (!graph || !selectedNodeId) return []
    return graph.edges.filter((e) => e.from === selectedNodeId)
  }, [graph, selectedNodeId])

  return {
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    inbound,
    outbound,
  }
}
