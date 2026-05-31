export type AnalysisJobStatus = "pending" | "running" | "completed" | "failed"

export interface ApiError {
  error: string
  code?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  cursor?: string
  hasMore: boolean
  /** Present on filtered PR list responses */
  total?: number
}

/** GET /api/analysis/jobs/stats — workspace summary for dashboard */
export interface AnalysisJobsStats {
  pendingAssigned: number
  changesRequested: number
  highRisk: number
  approved: number
  weeklyAnalysisCount: number
}

export interface AiUsageMetrics {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costCny: number
  latencyMs?: number
}

export interface AiPersistedContent {
  content: string
  analyzedAt: string
  model?: string
  provider?: string
  usage?: AiUsageMetrics
}

/** @deprecated Use AiPersistedContent */
export type RepositoryAiAnalysis = AiPersistedContent

export type RepositorySourceType = "github" | "external"

export type RepositoryType = "owned" | "managed" | "external"

export type RepositoryJobType =
  | "clone"
  | "architecture"
  | "security"
  | "performance"
  | "onboarding"
  | "sync"
  | "repo_ai"
  | "sync_prs"

export type RepositoryJobStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "cancelled"

export interface RepositoryJob {
  id: string
  repositoryId: string
  jobType: RepositoryJobType
  status: RepositoryJobStatus
  progress: number
  message?: string | null
  parentJobId?: string | null
  payload?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  finishedAt?: string | null
}

export interface Repository {
  id: string
  githubId?: string | null
  fullName: string
  name: string
  owner: string
  sourceType?: RepositorySourceType
  repositoryType?: RepositoryType
  managed?: boolean
  /** Canonical adoption flag from API (managed OR repositoryType=managed). */
  isManaged?: boolean
  localPath?: string | null
  lastClonedAt?: string | null
  lastCommitSha?: string | null
  activeJob?: RepositoryJob | null
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

export interface AdoptRepositoryResponse {
  ok: boolean
  repository: Repository
  jobId: string
}

export interface OnboardRepositoryBody {
  repoId: string
}

export type OnboardRepositoryResponse = AdoptRepositoryResponse

export type OnboardingPhase =
  | "queued"
  | "cloning"
  | "scanning"
  | "analyzing"
  | "completed"
  | "failed"

export interface ImportPullRequestResult {
  prId: string
  repoId: string
  source: "cache" | "github_app" | "github_public" | string
  repositoryCreated: boolean
  analysisJobId?: string
  analysisQueued?: boolean
  analysisCacheHit?: boolean
}

export type AnalysisJobPhase =
  | "queued"
  | "fetching_diff"
  | "scanning"
  | "generating_summary"
  | "saving_results"
  | "completed"

export interface StartAnalysisResponse {
  jobId: string
  queued: boolean
  cacheHit: boolean
  cached: boolean
  analysisVersion?: string
}

export interface StartRepoAnalyzeResponse {
  jobId?: string
  jobs?: RepositoryJob[]
}

export interface RepoAnalysisStatusResponse {
  latest?: RepositoryJob | null
  jobs: RepositoryJob[]
}

export interface SyncRepositoriesResponse {
  synced: number
  created: number
  updated: number
  status: string
  syncedRepos?: number
}

export interface AuthUser {
  id: string
  githubId: string
  username: string
  login?: string
  name?: string
  email?: string | null
  avatarUrl?: string | null
  lastLoginAt?: string | null
}

export type GithubTokenStatus = "valid" | "missing" | "expired"

export interface GithubAccountInfo {
  login: string
  avatarUrl?: string | null
  email?: string | null
  githubId: string
  syncedRepoCount: number
  lastSyncedAt?: string | null
  tokenStatus: GithubTokenStatus
}

export interface AuthLoginResponse {
  url: string
}

export interface SyncPrsResponse {
  synced: number
  created: number
  updated: number
}

export interface ActivityEvent {
  type: string
  user: string
  action: string
  repo: string
  time: string
  createdAt?: string
  pullRequestId?: string | null
  payload?: Record<string, unknown> | null
}

export interface DashboardActivitiesResponse {
  activities: ActivityEvent[]
}

export interface RepoAnalyzeContext {
  repository: Repository
  recentFindings: AnalysisFinding[]
  readme: string
  fileTree?: string
  configSnippets?: Record<string, string>
  contextWarnings?: string[]
}

export type ReviewStatus =
  | "OPEN"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "MERGED"
  | "CLOSED"

export type ReviewCommentType = "COMMENT" | "APPROVE" | "REQUEST_CHANGES"

export interface ReviewComment {
  id: string
  prId: string
  userId?: string | null
  userName: string
  type: ReviewCommentType
  content: string
  createdAt: string
  /** Present on POST /comments when status was updated. */
  reviewStatus?: ReviewStatus
}

export interface ReviewTimelineEvent {
  id: string
  prId: string
  eventType: string
  actor: string
  actorType: "user" | "ai" | "system"
  content?: string | null
  payload?: Record<string, unknown> | null
  createdAt: string
}

export interface ReviewStatusCounts {
  ALL: number
  OPEN: number
  IN_REVIEW: number
  CHANGES_REQUESTED: number
  APPROVED: number
  MERGED: number
  CLOSED: number
}

export interface ReviewCenterDashboard {
  pendingReview: number
  inReview: number
  assignedToMe: number
  myCreated: number
  highRisk: number
  weeklyApprovals: number
  aiFindingsThisWeek: number
  statusCounts: ReviewStatusCounts
}

export interface ReviewCenterStats {
  weeklyAnalysisCount: number
  aiCalls: number
  totalTokens: number
  costCny: number
  approvalRate: number
  rejectionRate: number
  avgApprovalHours: number
  highRiskCount: number
  dailyTrend: { date: string; analysisCount: number }[]
}

export interface RepoReviewGroupItem {
  id: string
  name: string
  fullName: string
  prCount: number
  language?: string | null
}

export interface RepoReviewGroup {
  id: string
  label: string
  repos: RepoReviewGroupItem[]
}

export interface ApprovalCheckResult {
  blocked: boolean
  reasons: string[]
  securityScore?: number
  criticalCount?: number
}

export interface PullRequestListItem {
  id: string
  repoId: string
  repo: string
  number: number
  title: string
  author: string
  state: "open" | "closed" | "merged"
  reviewStatus?: ReviewStatus
  riskLevel: "critical" | "high" | "medium" | "low"
  riskScore: number
  updatedAt: string
  createdAt?: string
  displayName?: string
  note?: string
  favorite?: boolean
  aiSummary?: AiPersistedContent | null
  headSha?: string | null
  sourceType?: RepositorySourceType
  repositoryType?: RepositoryType
  managed?: boolean
  isManaged?: boolean
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
  pullRequestId?: string | null
  repositoryId?: string | null
  status: AnalysisJobStatus
  progress: number
  chunkIndex: number
  chunkTotal: number
  phase?: AnalysisJobPhase
  cacheHit?: boolean
  analysisVersion?: string
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

export type FindingCategory =
  | "security"
  | "performance"
  | "architecture"
  | "maintainability"
  | "convention"

/** Unified findings center row (analysis + governance). */
export interface UnifiedFinding {
  id: string
  findingType: FindingCategory
  typeLabel: string
  repo: string
  repoId?: string
  prNumber: number
  pullRequestId?: string | null
  file: string
  line: number
  severity: "critical" | "high" | "medium" | "low"
  rule: string
  description: string
  suggestion: string
  status?: "open" | "ignored" | "resolved"
  title?: string
  discoveredAt?: string | null
  aiInsight?: AiPersistedContent | null
  note?: string | null
  impact?: string | null
}

export interface FindingsStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

export interface FindingsCategoryStats {
  counts: Record<FindingCategory, number>
  maxSeverity: Partial<Record<FindingCategory, "critical" | "high" | "medium" | "low">>
}

export interface FindingsPage {
  items: UnifiedFinding[]
  total: number
  page: number
  pageSize: number
  stats: FindingsStats
  categoryStats: FindingsCategoryStats
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
    truncated?: boolean
    filesDiscovered?: number
    edgesTruncated?: boolean
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

export interface RecentActivityResponse {
  activities: DashboardActivity[]
}

export interface DashboardRepoHealth {
  id: string
  name: string
  fullName?: string
  prs: number
  issues: number
  /** @deprecated Not shown in UI; kept for backward compatibility */
  health?: number
}

export interface DashboardRecentReview {
  pullRequestId: string
  title: string
  riskScore: number
  completedAt: string
  mergeRecommendation: string
  jobId: string
}

export interface DashboardAnalysisCache {
  hitRate: number
  savedTimeMs: number
  savedTimeLabel: string
  estimatedCostSavedUsd: number
}

export interface DashboardStats {
  pendingPrs: number
  securityIssues: number
  qualityScore: number
  avgReviewHours: number
  analysisCache?: DashboardAnalysisCache
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
  runningTasks?: {
    pullRequests: number
    aiReview: number
    security: number
    governance: number
    performance: number
  }
}

export interface WeeklySummaryResponse {
  content: string
  usage?: Record<string, unknown>
  latencyMs?: number
}

export type SessionTimeoutMinutes = 0 | 15 | 30 | 60 | 120

export interface SecuritySettings {
  twoFactorEnabled: boolean
  sessionTimeoutMinutes: SessionTimeoutMinutes
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
  security: SecuritySettings
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
