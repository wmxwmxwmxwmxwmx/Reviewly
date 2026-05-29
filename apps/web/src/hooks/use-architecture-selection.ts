"use client"

import { useMemo, useState } from "react"

import type { ArchitectureEdge, ArchitectureGraph, ArchitectureNode } from "@/lib/api/architecture"

export function useArchitectureSelection(
  graph: ArchitectureGraph | null,
  controlledNodeId?: string | null,
  onSelectNode?: (id: string | null) => void,
) {
  const [internalId, setInternalId] = useState<string | null>(null)
  const selectedNodeId = controlledNodeId !== undefined ? controlledNodeId : internalId
  const setSelectedNodeId = (id: string | null) => {
    if (onSelectNode) {
      onSelectNode(id)
    } else {
      setInternalId(id)
    }
  }

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
