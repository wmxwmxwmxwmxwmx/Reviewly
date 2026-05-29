import { apiFetch } from "./client"

export interface ArchitectureNode {
  id: string
  label: string
}

export interface ArchitectureEdge {
  from: string
  to: string
}

export interface ArchitectureGraph {
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
  status: string
}

export function fetchArchitectureGraph(repoId: string, signal?: AbortSignal) {
  return apiFetch<ArchitectureGraph>(`/api/architecture/repos/${repoId}/graph`, { signal })
}
