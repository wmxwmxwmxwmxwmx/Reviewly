"use client"

import { motion } from "framer-motion"
import { Users, TrendingUp, TrendingDown, GitPullRequest, MessageSquare, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

const members = [
  { name: "张维", avatar: "ZW", role: "高级工程师", prs: 24, reviews: 45, avgTime: "1.2h", trend: "up" },
  { name: "李明", avatar: "LM", role: "技术专家", prs: 18, reviews: 62, avgTime: "0.8h", trend: "up" },
  { name: "王芳", avatar: "WF", role: "工程师", prs: 32, reviews: 28, avgTime: "2.1h", trend: "down" },
  { name: "陈浩", avatar: "CH", role: "工程师", prs: 15, reviews: 35, avgTime: "1.5h", trend: "neutral" },
]

export function TeamView() {
  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">团队分析</h1>
        <p className="text-sm text-muted-foreground mt-0.5">团队成员贡献与协作数据</p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">团队成员</span>
        </div>
        <div className="divide-y divide-border">
          {members.map((member, idx) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="px-4 py-3 flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[oklch(0.55_0.19_240)] to-[oklch(0.45_0.14_264)] flex items-center justify-center text-xs font-semibold text-white">
                {member.avatar}
              </div>
              <div className="w-32">
                <div className="text-sm font-medium text-foreground">{member.name}</div>
                <div className="text-xs text-muted-foreground">{member.role}</div>
              </div>
              <div className="flex items-center gap-6 flex-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><GitPullRequest className="w-3 h-3" />{member.prs} PRs</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{member.reviews} 评审</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />平均 {member.avgTime}</span>
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs",
                member.trend === "up" ? "text-risk-low" : member.trend === "down" ? "text-risk-high" : "text-muted-foreground"
              )}>
                {member.trend === "up" && <><TrendingUp className="w-3 h-3" />提升</>}
                {member.trend === "down" && <><TrendingDown className="w-3 h-3" />下降</>}
                {member.trend === "neutral" && <>稳定</>}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
