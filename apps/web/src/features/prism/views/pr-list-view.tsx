"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  GitPullRequest,
  GitBranch,
  Clock,
  Search,
  ChevronRight,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { usePullRequests } from "@/hooks/use-pull-requests"
import { usePersistedViewState } from "@/hooks/use-persisted-view-state"

type FilterTab = "all" | "open" | "closed"

export function PRListView() {
  const { items: apiPrs, loading, error, reload } = usePullRequests()
  const { navigate } = useNavigation()
  const [listState, setListState] = usePersistedViewState<{ search: string; filterTab: FilterTab }>(
    "pull-requests",
    { search: "", filterTab: "open" },
  )
  const search = listState.search
  const filterTab = listState.filterTab
  const setSearch = (search: string) => setListState({ search })
  const setFilterTab = (filterTab: FilterTab) => setListState({ filterTab })

  const filteredPRs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return apiPrs.filter((pr) => {
      const matchesSearch =
        !normalizedSearch ||
        pr.title.toLowerCase().includes(normalizedSearch) ||
        pr.author.toLowerCase().includes(normalizedSearch)

      const matchesTab =
        filterTab === "all" ||
        (filterTab === "open" && pr.state === "open") ||
        (filterTab === "closed" && pr.state !== "open")

      return matchesSearch && matchesTab
    })
  }, [apiPrs, search, filterTab])

  const stats = useMemo(() => {
    const openCount = apiPrs.filter((p) => p.state === "open").length
    const mergedCount = apiPrs.filter((p) => p.state === "merged").length
    const highRiskCount = apiPrs.filter((p) => p.riskLevel === "critical" || p.riskLevel === "high").length
    const totalCount = apiPrs.length
    return [
      { label: "待评审 PR", value: String(openCount), color: "text-ai-blue" },
      { label: "已合并", value: String(mergedCount), color: "text-risk-low" },
      { label: "高/临界风险", value: String(highRiskCount), color: "text-risk-high" },
      { label: "总 PR", value: String(totalCount), color: "text-foreground" },
    ]
  }, [apiPrs])

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{zh.pr.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.pullRequests}</p>
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
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-risk-high/30 bg-risk-high/10 px-4 py-3 text-sm text-risk-high flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => reload()} className="text-xs underline shrink-0 ml-3">
            重试
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-surface-2 border border-border space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-12" />
              </div>
            ))
          : stats.map((stat) => (
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
            <span className="text-sm font-medium text-foreground">{zh.pr.allPullRequests}</span>
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
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              加载合并请求…
            </div>
          )}
          {!loading && filteredPRs.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {apiPrs.length === 0
                ? "暂无合并请求，请检查后端服务或仓库同步。"
                : "没有符合筛选条件的合并请求。"}
            </div>
          )}
          {!loading && filteredPRs.map((pr, idx) => {
            return (
              <motion.div
                key={pr.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                role="button"
                tabIndex={0}
                onClick={() => navigate("ai-review", { prId: pr.id })}
                onKeyDown={(e) => e.key === "Enter" && navigate("ai-review", { prId: pr.id })}
                className="px-4 py-3 hover:bg-surface-2/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "p-1.5 rounded",
                      pr.riskLevel === "critical"
                        ? "bg-[oklch(0.55_0.22_27/0.12)]"
                        : pr.riskLevel === "high"
                          ? "bg-[oklch(0.62_0.21_32/0.12)]"
                          : pr.riskLevel === "medium"
                            ? "bg-[oklch(0.75_0.15_85/0.12)]"
                            : "bg-surface-3",
                    )}
                  >
                    <GitPullRequest
                      className={cn(
                        "w-4 h-4",
                        pr.riskLevel === "critical"
                          ? "text-[oklch(0.55_0.22_27)]"
                          : pr.riskLevel === "high"
                            ? "text-risk-high"
                            : pr.riskLevel === "medium"
                              ? "text-risk-medium"
                              : "text-risk-low",
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground hover:text-ai-blue transition-colors">
                        {pr.title}
                      </span>
                      <span className="text-xs text-muted-foreground">#{pr.number}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[oklch(0.55_0.19_240)] to-[oklch(0.45_0.14_264)] flex items-center justify-center text-[8px] font-semibold text-white">
                          {pr.authorAvatar}
                        </div>
                        {pr.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        <span className="font-mono">{pr.sourceBranch}</span>
                        <span>→</span>
                        <span className="font-mono">{pr.targetBranch}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {pr.updatedAt || pr.createdAt}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {pr.labels.map((label) => (
                        <span
                          key={label.name}
                          className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground"
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">
                      {pr.state === "open" ? "待评审" : pr.state === "merged" ? "已合并" : "已关闭"}
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
