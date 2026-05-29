export interface PRData {
  url: string
  repo: string
  number: number
  sourceBranch: string
  targetBranch: string
  title: string
  author: string
  authorAvatar: string
  createdAt: string
  labels: { name: string; color: string }[]
  filesChanged: number
  additions: number
  deletions: number
  commits: number
  riskScore: number
  riskLevel: "critical" | "high" | "medium" | "low"
  securityScore: number
  performanceScore: number
  maintainabilityScore: number
  deploymentRisk: "high" | "medium" | "low"
  rollbackComplexity: "high" | "medium" | "low"
}

export interface RiskItem {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  type: string
  title: string
  description: string
  file: string
  line: number
  cweId?: string
  confidence: number
  rootCause: string
  exploitability: "high" | "medium" | "low"
  fixSuggestion: string
  callChain?: string[]
}

export interface DiffFile {
  path: string
  type: "modified" | "added" | "deleted"
  additions: number
  deletions: number
  riskLevel: "critical" | "high" | "medium" | "low" | "none"
  language: string
  owner: string
  collapsed: boolean
  chunks: DiffChunk[]
}

export interface DiffChunk {
  header: string
  lines: DiffLine[]
}

export interface DiffLine {
  type: "context" | "add" | "delete"
  oldNum?: number
  newNum?: number
  content: string
  riskComment?: {
    severity: "critical" | "high" | "medium"
    message: string
  }
}
