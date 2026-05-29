"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  GitPullRequest,
  GitMerge,
  GitBranch,
  Clock,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Search,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNavigation } from "@/features/prism/contexts/navigation-context"

const pullRequests = [
  {
    id: 1842,
    title: "feat(auth): 实现 OAuth2.0 登录流程",
    author: "张维",
    avatar: "ZW",
    branch: "feature/oauth-login",
    target: "main",
    status: "review",
    checks: "passing",
    comments: 8,
    additions: 423,
    deletions: 56,
    files: 12,
    created: "2 小时前",
    labels: ["feature", "auth"],
  },
  {
    id: 1841,
    title: "fix(api): 修复用户查询 N+1 问题",
    author: "李明",
    avatar: "LM",
    branch: "fix/user-query-n1",
    target: "main",
    status: "approved",
    checks: "passing",
    comments: 3,
    additions: 45,
    deletions: 89,
    files: 4,
    created: "5 小时前",
    labels: ["bugfix", "performance"],
  },
  {
    id: 1840,
    title: "refactor: 重构订单模块架构",
    author: "王芳",
    avatar: "WF",
    branch: "refactor/order-module",
    target: "develop",
    status: "changes-requested",
    checks: "failing",
    comments: 15,
    additions: 1205,
    deletions: 876,
    files: 28,
    created: "1 天前",
    labels: ["refactor", "breaking-change"],
  },
  {
    id: 1839,
    title: "chore: 升级 React 到 v19",
    author: "陈浩",
    avatar: "CH",
    branch: "chore/react-19",
    target: "main",
    status: "draft",
    checks: "pending",
    comments: 2,
    additions: 234,
    deletions: 198,
    files: 8,
    created: "2 天前",
    labels: ["dependencies"],
  },
  {
    id: 1838,
    title: "docs: 更新 API 文档",
    author: "赵雪",
    avatar: "ZX",
    branch: "docs/api-update",
    target: "main",
    status: "merged",
    checks: "passing",
    comments: 1,
    additions: 156,
    deletions: 42,
    files: 6,
    created: "3 天前",
    labels: ["documentation"],
  },
]

const statusConfig = {
  review: { color: "text-ai-blue", bg: "bg-[oklch(0.62_0.19_240/0.15)]", label: "评审中", icon: GitPullRequest },
  approved: { color: "text-risk-low", bg: "bg-[oklch(0.62_0.17_148/0.15)]", label: "已批准", icon: CheckCircle2 },
  "changes-requested": { color: "text-risk-high", bg: "bg-[oklch(0.62_0.21_32/0.15)]", label: "需修改", icon: AlertCircle },
  draft: { color: "text-muted-foreground", bg: "bg-surface-3", label: "草稿", icon: GitBranch },
  merged: { color: "text-[oklch(0.6_0.16_300)]", bg: "bg-[oklch(0.6_0.16_300/0.15)]", label: "已合并", icon: GitMerge },
}

const checksConfig = {
  passing: { color: "text-risk-low", label: "通过" },
  failing: { color: "text-risk-high", label: "失败" },
  pending: { color: "text-risk-medium", label: "进行中" },
}

const prStats = [
  { label: "待评审", value: "12", color: "text-ai-blue" },
  { label: "已批准", value: "5", color: "text-risk-low" },
  { label: "需修改", value: "3", color: "text-risk-high" },
  { label: "本周合并", value: "24", color: "text-foreground" },
]

type FilterTab = "all" | "open" | "closed"

export function PRListView() {
  const { navigate } = useNavigation()
  const [search, setSearch] = useState("")
  const [filterTab, setFilterTab] = useState<FilterTab>("open")

  const filteredPRs = useMemo(() => {
    return pullRequests.filter((pr) => {
      const matchesSearch =
        !search ||
        pr.title.toLowerCase().includes(search.toLowerCase()) ||
        pr.author.toLowerCase().includes(search.toLowerCase())

      const matchesTab =
        filterTab === "all" ||
        (filterTab === "open" && pr.status !== "merged") ||
        (filterTab === "closed" && pr.status === "merged")

      return matchesSearch && matchesTab
    })
  }, [search, filterTab])

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Pull Request</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理和评审代码变更请求</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索 PR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 h-8 pl-8 pr-3 text-xs bg-surface-2 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ai-blue"
            />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-surface-2 rounded-md hover:bg-surface-3 transition-colors">
            <Filter className="w-3.5 h-3.5" />
            筛选
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {prStats.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-surface-2 border border-border"
          >
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className={cn("text-2xl font-semibold mt-1", stat.color)}>{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* PR List */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">所有 Pull Requests</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {(["all", "open", "closed"] as const).map((tab) => {
              const labels = { all: "全部", open: "待处理", closed: "已关闭" }
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={cn(
                    "px-2 py-1 rounded transition-colors",
                    filterTab === tab ? "bg-surface-3 text-foreground" : "hover:bg-surface-3"
                  )}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="divide-y divide-border">
          {filteredPRs.map((pr, idx) => {
            const status = statusConfig[pr.status as keyof typeof statusConfig]
            const checks = checksConfig[pr.checks as keyof typeof checksConfig]
            const StatusIcon = status.icon
            return (
              <motion.div
                key={pr.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                role="button"
                tabIndex={0}
                onClick={() => navigate("ai-review")}
                onKeyDown={(e) => e.key === "Enter" && navigate("ai-review")}
                className="px-4 py-3 hover:bg-surface-2/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-1.5 rounded", status.bg)}>
                    <StatusIcon className={cn("w-4 h-4", status.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground hover:text-ai-blue transition-colors">
                        {pr.title}
                      </span>
                      <span className="text-xs text-muted-foreground">#{pr.id}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[oklch(0.55_0.19_240)] to-[oklch(0.45_0.14_264)] flex items-center justify-center text-[8px] font-semibold text-white">
                          {pr.avatar}
                        </div>
                        {pr.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        <span className="font-mono">{pr.branch}</span>
                        <span>→</span>
                        <span className="font-mono">{pr.target}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {pr.created}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {pr.labels.map((label) => (
                        <span
                          key={label}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className={cn("flex items-center gap-1", checks.color)}>
                      {pr.checks === "passing" && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {pr.checks === "failing" && <XCircle className="w-3.5 h-3.5" />}
                      {pr.checks === "pending" && <Clock className="w-3.5 h-3.5" />}
                      {checks.label}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {pr.comments}
                    </span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-[oklch(0.62_0.17_148)]">+{pr.additions}</span>
                      <span className="text-[oklch(0.55_0.22_27)]">-{pr.deletions}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
