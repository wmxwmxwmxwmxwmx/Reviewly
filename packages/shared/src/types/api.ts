export type AnalysisJobStatus = "pending" | "running" | "completed" | "failed"

export interface ApiError {
  error: string
  code?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  cursor?: string
  hasMore: boolean
}

export interface AiPersistedContent {
  content: string
  analyzedAt: string
  model?: string
  provider?: string
}

/** @deprecated Use AiPersistedContent */
export type RepositoryAiAnalysis = AiPersistedContent

export interface Repository {
  id: string
  githubId?: string | null
  fullName: string
  name: string
  owner: string
  description?: string | null
  language?: string | null
  stars?: number
  forks?: number
  openPrCount: number
  defaultBranch: string
  cloneUrl?: string | null
  htmlUrl?: string | null
  avatarUrl?: string | null
  isPrivate?: boolean
  pushedAt?: string | null
  githubCreatedAt?: string | null
  githubUpdatedAt?: string | null
  lastSyncTime: string
  healthScore: number
  aiReviewEnabled: boolean
  aiAnalysis?: AiPersistedContent | null
  aiArchitectureAnalysis?: AiPersistedContent | null
}

export interface ImportRepositoryBody {
  url: string
}

export interface ImportRepositoryResponse {
  repository: Repository
}

export interface SyncRepositoriesResponse {
  synced: number
  created: number
  updated: number
  status: string
  syncedRepos?: number
}

export interface RepoAnalyzeContext {
  repository: Repository
  recentFindings: AnalysisFinding[]
  readme: string
}

export interface PullRequestListItem {
  id: string
  repoId: string
  repo: string
  number: number
  title: string
  author: string
  state: "open" | "closed" | "merged"
  riskLevel: "critical" | "high" | "medium" | "low"
  riskScore: number
  updatedAt: string
}

export interface PullRequest extends PullRequestListItem {
  sourceBranch: string
  targetBranch: string
  authorAvatar: string
  createdAt: string
  labels: { name: string; color: string }[]
  filesChanged: number
  additions: number
  deletions: number
  commits: number
  securityScore: number
  performanceScore: number
  maintainabilityScore: number
  deploymentRisk: "high" | "medium" | "low"
  rollbackComplexity: "high" | "medium" | "low"
  url: string
}

export interface AnalysisJob {
  id: string
  pullRequestId: string
  status: AnalysisJobStatus
  progress: number
  chunkIndex: number
  chunkTotal: number
  error?: string
  createdAt: string
  completedAt?: string
}

export interface AnalysisFinding {
  id: string
  type: "security" | "performance" | "architecture" | "maintainability"
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  file: string
  line: number
  confidence: number
  rootCause: string
  fixSuggestion: string
  cweId?: string
  callChain?: string[]
}

export interface AnalysisSummary {
  summary: string
  mergeRecommendation: "approve" | "request_changes" | "block"
  riskScore: number
  securityScore: number
  performanceScore: number
  maintainabilityScore: number
}

export interface SecurityFinding extends AnalysisFinding {
  type: "security"
  exploitability?: "high" | "medium" | "low"
  status?: "open" | "ignored" | "resolved"
}

/** Security Center list row (aggregated across PRs). */
export interface SecurityCenterFinding {
  id: string
  repo: string
  prNumber: number
  file: string
  line: number
  severity: "critical" | "high" | "medium" | "low"
  rule: string
  description: string
  suggestion: string
  status?: "open" | "ignored" | "resolved"
  pullRequestId?: string
  title?: string
  aiInsight?: AiPersistedContent | null
}

export interface SecurityFindingsPage {
  items: SecurityCenterFinding[]
  total: number
  page: number
  pageSize: number
}

export interface PerformanceFinding extends AnalysisFinding {
  type: "performance"
}

/** Performance Center list row (aggregated across PRs). */
export interface PerformanceCenterFinding {
  id: string
  file: string
  line: number
  type: string
  severity: "critical" | "high" | "medium" | "low"
  description: string
  suggestion: string
  repo?: string
  prNumber?: number
  pullRequestId?: string
  title?: string
  ruleId?: string
  aiOptimization?: AiPersistedContent | null
}

export interface PerformanceFindingsPage {
  items: PerformanceCenterFinding[]
  total: number
  page: number
  pageSize: number
}

export interface ArchitectureFinding extends AnalysisFinding {
  type: "architecture"
}

export interface ArchitectureNode {
  id: string
  label: string
  path?: string
  language?: string
  layer?: string
  lines?: number
  importCount?: number
}

export interface ArchitectureEdge {
  from: string
  to: string
  kind?: string
}

export interface ArchitectureScanMetrics {
  cycles: string[][]
  giantModules: {
    id: string
    path: string
    lines: number
    importCount: number
  }[]
  layerViolations: { from: string; to: string; reason: string }[]
  summary: {
    fileCount: number
    edgeCount: number
    languages: Record<string, number>
  }
}

export interface ArchitectureGraph {
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
  metrics?: ArchitectureScanMetrics
  status: string
  scannedAt?: string
  cachePath?: string
}

export type GovernanceMatchType = "keyword" | "file_pattern" | "finding" | "any"

export interface GovernanceRule {
  id: string
  rule: string
  severity: "critical" | "high" | "medium" | "low"
  enabled?: boolean
  description?: string | null
  matchType?: GovernanceMatchType
  keywords?: string[]
  filePatterns?: string[]
  findingTypes?: Array<AnalysisFinding["type"]>
  findingSeverities?: Array<AnalysisFinding["severity"]>
  /** Per-PR evaluation (GET .../pull-requests/:id/governance) */
  violated?: boolean
  file?: string | null
  feedback?: string | null
  evidence?: string[]
  evaluatedAt?: string | null
}

export type GovernanceRuleInput = Pick<
  GovernanceRule,
  | "rule"
  | "severity"
  | "enabled"
  | "description"
  | "matchType"
  | "keywords"
  | "filePatterns"
  | "findingTypes"
  | "findingSeverities"
>

export interface TeamMember {
  id: string
  name: string
  role: string
  reviewsThisWeek: number
  avgReviewTimeHours: number
  riskFindings: number
}

export interface DashboardActivity {
  type: string
  user: string
  action: string
  repo: string
  time: string
  createdAt?: string
  pullRequestId?: string
  payload?: Record<string, unknown> | null
}

export interface DashboardRepoHealth {
  name: string
  prs: number
  issues: number
  health: number
}

export interface DashboardRecentReview {
  pullRequestId: string
  title: string
  riskScore: number
  completedAt: string
  mergeRecommendation: string
  jobId: string
}

export interface DashboardStats {
  pendingPrs: number
  securityIssues: number
  qualityScore: number
  avgReviewHours: number
  recentActivity: DashboardActivity[]
  topRepos: DashboardRepoHealth[]
  summary?: {
    openPrCount: number
    highRiskCount: number
    securityCount: number
    performanceCount: number
  }
  recentReviews?: DashboardRecentReview[]
  activities?: DashboardActivity[]
  riskDistribution?: Record<string, number>
  analysisTiming?: {
    avgDurationMs: number
    completedCount: number
    recent: {
      jobId: string
      pullRequestId: string
      durationMs: number
      completedAt: string
    }[]
  }
  weeklySummary?: AiPersistedContent | null
}

export interface WeeklySummaryResponse {
  content: string
  usage?: Record<string, unknown>
  latencyMs?: number
}

export interface PrismSettings {
  ai: {
    provider: string
    model: string
    temperature: number
  }
  analysis: {
    autoRunOnOpen: boolean
    maxChunks: number
  }
  notifications: {
    emailEnabled: boolean
    slackWebhook?: string
  }
}

export interface PullRequestFilters {
  repo?: string
  risk?: string
  author?: string
  state?: string
  sort?: string
  cursor?: string
  limit?: number
}
