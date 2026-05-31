"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Activity,
  BarChart3,
  BrainCircuit,
  ChevronRight,
  ClipboardCheck,
  FolderGit2,
  Github,
  Plus,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  PencilLine,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ImportPRDialog } from "@/features/prism/components/import-pr-dialog"
import { useAuth } from "@/features/prism/contexts/auth-context"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useDashboardWorkspace } from "@/hooks/use-dashboard-workspace"
import { useImportPrByUrl } from "@/hooks/use-import-pr-by-url"
import { formatActivityLine } from "@/lib/format-activity-line"
import { formatWorkspaceGreeting } from "@/lib/dashboard-greeting"
import { resolveDashboardRepoGroups } from "@/lib/group-repos-for-dashboard"
import { cn } from "@/lib/utils"
import { zh } from "@/lib/i18n/zh"

const STAT_CARDS = [
  {
    key: "pendingAssigned" as const,
    label: "待我审批",
    icon: ClipboardCheck,
    color: "text-ai-blue",
    bg: "bg-ai-blue/10 border-ai-blue/20",
    reviewTab: "inbox" as const,
  },
  {
    key: "changesRequested" as const,
    label: "待修改",
    icon: PencilLine,
    color: "text-risk-medium",
    bg: "bg-risk-medium/10 border-risk-medium/20",
    reviewTab: "all" as const,
  },
  {
    key: "highRisk" as const,
    label: "高风险 PR",
    icon: ShieldAlert,
    color: "text-risk-high",
    bg: "bg-risk-high/10 border-risk-high/20",
    reviewTab: "all" as const,
  },
  {
    key: "approved" as const,
    label: "已通过 PR",
    icon: CheckCircle2,
    color: "text-risk-low",
    bg: "bg-risk-low/10 border-risk-low/20",
    reviewTab: "all" as const,
  },
  {
    key: "weeklyAnalysisCount" as const,
    label: "本周 AI 分析",
    icon: BrainCircuit,
    color: "text-ai-purple",
    bg: "bg-ai-purple/10 border-ai-purple/20",
    reviewTab: "insights" as const,
    suffix: "次",
  },
]

export function DashboardView() {
  const { navigate } = useNavigation()
  const { user } = useAuth()
  const { stats, activities, repoGroups, repos, loading, error, refetch, isValidating } =
    useDashboardWorkspace()
  const [importOpen, setImportOpen] = useState(false)
  const { importing, handleImportUrl } = useImportPrByUrl({
    onImportSuccess: () => {
      setImportOpen(false)
      void refetch()
    },
  })

  const greeting = formatWorkspaceGreeting(user)
  const displayRepoGroups = resolveDashboardRepoGroups(repoGroups, repos)
  const hasRepoGroups = displayRepoGroups.some((g) => g.repos.length > 0)

  return (
    <div className="p-5 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold text-foreground tracking-tight">
            <span className="mr-2" aria-hidden>
              👋
            </span>
            {greeting}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{zh.pageSubtitle.dashboard}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={cn("size-3.5", isValidating && "animate-spin")} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-risk-high/30 bg-risk-high/10 px-4 py-3 text-sm text-risk-high flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => refetch()}>
            重试
          </Button>
        </div>
      )}

      <section aria-label="我的工作台统计">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">我的工作台</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {loading
            ? Array.from({ length: 5 }).map((_, idx) => (
                <Card key={idx} className="py-4 gap-3 bg-surface-2 border-border shadow-none">
                  <CardContent className="px-4 space-y-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-7 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </CardContent>
                </Card>
              ))
            : STAT_CARDS.map((card, idx) => {
                const Icon = card.icon
                const value = stats[card.key]
                return (
                  <motion.button
                    key={card.key}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => navigate("ai-review", { reviewTab: card.reviewTab })}
                    className="text-left"
                  >
                    <Card
                      className={cn(
                        "py-4 gap-2 bg-surface-2 border shadow-none transition-colors hover:bg-surface-2/80",
                        card.bg,
                      )}
                    >
                      <CardContent className="px-4">
                        <Icon className={cn("size-5 mb-2", card.color)} />
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-2xl font-semibold text-foreground tabular-nums">
                            {value}
                          </span>
                          {card.suffix && (
                            <span className="text-xs text-muted-foreground">{card.suffix}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                      </CardContent>
                    </Card>
                  </motion.button>
                )
              })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-surface-2 border-border shadow-none gap-0 py-0 overflow-hidden">
          <CardHeader className="px-4 py-3 border-b border-border bg-surface-2/80">
            <div className="flex items-center gap-2">
              <FolderGit2 className="size-4 text-ai-blue" />
              <CardTitle className="text-sm font-medium">最近仓库</CardTitle>
            </div>
            <CardDescription className="text-xs">按分组浏览已接入仓库</CardDescription>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-10 w-full" />
                ))}
              </div>
            ) : !hasRepoGroups ? (
              <div className="px-4 py-8 text-center space-y-2">
                <p className="text-sm text-muted-foreground">{zh.dashboard.noReposHint}</p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-ai-blue"
                  onClick={() => navigate("repos")}
                >
                  {zh.dashboard.goToRepos}
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
                {displayRepoGroups.map((group) =>
                  group.repos.length === 0 ? null : (
                    <div key={group.id} className="px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        {group.label}
                      </p>
                      <ul className="space-y-1">
                        {group.repos.map((repo) => (
                          <li key={repo.id}>
                            <button
                              type="button"
                              onClick={() => navigate("repos", { repoId: repo.id })}
                              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-surface-3/80 transition-colors group"
                            >
                              <span className="text-muted-foreground font-mono text-xs">└</span>
                              <span className="font-mono truncate flex-1 text-left">
                                {repo.name}
                              </span>
                              {repo.prCount > 0 && (
                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                  {repo.prCount} PR
                                </Badge>
                              )}
                              <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-surface-2 border-border shadow-none gap-0 py-0 overflow-hidden">
          <CardHeader className="px-4 py-3 border-b border-border bg-surface-2/80">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-ai-blue" />
              <CardTitle className="text-sm font-medium">最近活动</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-8 w-full" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">暂无活动记录</p>
            ) : (
              <ul className="divide-y divide-border max-h-[320px] overflow-y-auto">
                {activities.map((activity, idx) => (
                  <li key={`${activity.createdAt ?? activity.time}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (activity.pullRequestId) {
                          navigate("ai-review", { prId: activity.pullRequestId })
                          return
                        }
                        if (activity.type.includes("pr")) {
                          navigate("ai-review", { reviewTab: "all" })
                        }
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-3/50 transition-colors flex items-center gap-2"
                    >
                      <span className="text-foreground truncate font-mono text-xs sm:text-sm">
                        {formatActivityLine(activity)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-label="快捷操作">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">快捷操作</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setImportOpen(true)} className="gap-2">
            <Plus className="size-4" />
            导入 PR
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("ai-review", { reviewTab: "inbox" })}
            className="gap-2"
          >
            <ClipboardCheck className="size-4" />
            我的待审批
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("ai-review", { reviewTab: "insights" })}
            className="gap-2"
          >
            <BarChart3 className="size-4" />
            查看统计
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("repos")}
            className="gap-2"
          >
            <Github className="size-4" />
            仓库管理
          </Button>
        </div>
      </section>

      <ImportPRDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        importing={importing}
        onImport={handleImportUrl}
      />
    </div>
  )
}
