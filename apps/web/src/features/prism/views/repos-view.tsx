"use client"

import { motion } from "framer-motion"
import { BookOpen, GitBranch, Star, Clock, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

import { useRepos } from "@/hooks/use-repos"

export function ReposView() {
  const { repos, loading, error } = useRepos()

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">仓库管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">已连接的代码仓库</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:bg-[oklch(0.55_0.19_240)] transition-colors">
          <BookOpen className="w-3.5 h-3.5" />
          添加仓库
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {error && <p className="text-sm text-risk-high col-span-2">{error}</p>}

        {!loading &&
          repos.map((repo, idx) => {
            const health = repo.healthScore
            return (
              <motion.div
                key={repo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-lg bg-surface-2 border border-border hover:border-ai-blue/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground font-mono">
                      {repo.fullName.split("/").slice(-2).join("/")}
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">
                        默认分支：{repo.defaultBranch}
                      </span>
                      {repo.aiReviewEnabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-ai-blue/20 text-ai-blue">
                          AI 可用
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="p-1 hover:bg-surface-3 rounded transition-colors" type="button">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 opacity-70" />
                    {repo.openPrCount} PR
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {repo.defaultBranch}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    —
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">健康度</span>
                    <span
                      className={cn(
                        "font-medium",
                        health >= 85 ? "text-risk-low" : health >= 70 ? "text-risk-medium" : "text-risk-high",
                      )}
                    >
                      {health}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        health >= 85 ? "bg-risk-low" : health >= 70 ? "bg-risk-medium" : "bg-risk-high",
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${health}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.1 }}
                    />
                  </div>
                </div>
              </motion.div>
            )
          })}
      </div>
    </div>
  )
}
