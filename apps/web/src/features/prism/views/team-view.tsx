"use client"

import { motion } from "framer-motion"
import { Users, TrendingUp, TrendingDown } from "lucide-react"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import { useTeam } from "@/hooks/use-team"

export function TeamView() {
  const { members, loading, error } = useTeam()

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">团队分析</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.team}</p>
      </div>

      {error && <p className="text-sm text-risk-high">{error}</p>}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">团队成员</span>
        </div>
        <div className="divide-y divide-border">
          {loading && <p className="px-4 py-6 text-sm text-muted-foreground">加载中…</p>}
          {!loading && members.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">{zh.sidebar.noTeamMember}</p>
          )}
          {!loading &&
            members.map((member, idx) => {
              const avatar =
                member.name?.slice(0, 2).toUpperCase() ??
                member.id.slice(0, 2).toUpperCase()
              const trend = member.riskFindings > 2 ? "down" : "up"
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="px-4 py-3 flex items-center gap-4"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[oklch(0.55_0.19_240)] to-[oklch(0.45_0.14_264)] flex items-center justify-center text-xs font-semibold text-white">
                    {avatar}
                  </div>
                  <div className="w-32">
                    <div className="text-sm font-medium text-foreground">{member.name}</div>
                    <div className="text-xs text-muted-foreground">{member.role}</div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm font-medium text-foreground">{member.reviewsThisWeek}</div>
                      <div className="text-xs text-muted-foreground">本周评审</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {member.avgReviewTimeHours}h
                      </div>
                      <div className="text-xs text-muted-foreground">平均耗时</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{member.riskFindings}</div>
                      <div className="text-xs text-muted-foreground">风险发现</div>
                    </div>
                  </div>
                  <div className={cn(trend === "up" ? "text-risk-low" : "text-risk-medium")}>
                    {trend === "up" ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                </motion.div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
