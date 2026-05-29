"use client"

import { motion } from "framer-motion"
import { GitBranch, CheckCircle2, XCircle, AlertTriangle, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGovernance } from "@/hooks/use-governance"

const statusConfig = {
  passing: { icon: CheckCircle2, color: "text-risk-low", bg: "bg-[oklch(0.62_0.17_148/0.15)]" },
  failing: { icon: XCircle, color: "text-risk-high", bg: "bg-[oklch(0.62_0.21_32/0.15)]" },
  warning: { icon: AlertTriangle, color: "text-risk-medium", bg: "bg-[oklch(0.75_0.15_85/0.15)]" },
}

function ruleStatus(rule: { violated?: boolean; severity?: string }) {
  if (rule.violated) return "failing"
  if (rule.severity === "critical" || rule.severity === "high") return "warning"
  return "passing"
}

export function GovernanceView() {
  const { rules, loading, error } = useGovernance()

  const displayRules = rules.map((r) => ({
    name: r.rule,
    status: ruleStatus(r),
    value: r.violated ? (r.file ?? "未通过") : "通过",
    category: r.severity ?? "治理",
  }))

  const passing = displayRules.filter((r) => r.status === "passing").length
  const total = displayRules.length || 1

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">工程治理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">代码规范与质量门禁检查</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-surface-2 rounded-md hover:bg-surface-3 transition-colors">
          <Settings className="w-3.5 h-3.5" />
          配置规则
        </button>
      </div>

      {error && (
        <p className="text-sm text-risk-high">{error}</p>
      )}

      <div className="p-4 rounded-lg bg-surface-2 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-semibold text-foreground">
              {loading ? "—" : `${passing}/${total}`}
            </span>
            <span className="text-sm text-muted-foreground ml-2">规则通过</span>
          </div>
          <div className="w-48 h-2 rounded-full bg-surface-3 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-risk-low"
              initial={{ width: 0 }}
              animate={{ width: `${(passing / total) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">规则检查</span>
        </div>
        <div className="divide-y divide-border">
          {loading && (
            <p className="px-4 py-6 text-sm text-muted-foreground">加载中…</p>
          )}
          {!loading &&
            displayRules.map((rule, idx) => {
              const status = statusConfig[rule.status as keyof typeof statusConfig]
              const StatusIcon = status.icon
              return (
                <motion.div
                  key={`${rule.name}-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="px-4 py-3 flex items-center gap-3"
                >
                  <div className={cn("p-1.5 rounded", status.bg)}>
                    <StatusIcon className={cn("w-4 h-4", status.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-foreground">{rule.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 px-1.5 py-0.5 bg-surface-3 rounded">
                      {rule.category}
                    </span>
                  </div>
                  <span className={cn("text-xs", status.color)}>{rule.value}</span>
                </motion.div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
