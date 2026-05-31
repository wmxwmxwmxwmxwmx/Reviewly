"use client"

import type { GovernanceRule } from "@reviewly/shared"

import { cn } from "@/lib/utils"

type GovernanceRuleResultsProps = {
  rules: GovernanceRule[]
  loading?: boolean
  className?: string
}

function ruleStatus(rule: GovernanceRule): "pass" | "violate" | "pending" {
  if (rule.evaluatedAt == null && rule.violated === undefined) return "pending"
  return rule.violated ? "violate" : "pass"
}

export function GovernanceRuleResults({
  rules,
  loading = false,
  className,
}: GovernanceRuleResultsProps) {
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-muted-foreground mb-1.5">工程治理检查</p>
        <p className="text-[11px] text-muted-foreground animate-pulse">加载中…</p>
      </div>
    )
  }

  if (rules.length === 0) {
    return (
      <div className={cn("space-y-1", className)}>
        <p className="text-muted-foreground mb-1.5">工程治理检查</p>
        <p className="text-[11px] text-muted-foreground">暂无启用的治理规则</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-muted-foreground mb-1.5">工程治理检查</p>
      <ul className="space-y-2">
        {rules.map((rule) => {
          const status = ruleStatus(rule)
          return (
            <li
              key={rule.id}
              className="rounded-md border border-border bg-card/50 px-2.5 py-2 space-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12px] font-medium text-foreground leading-snug">
                  {rule.rule}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium shrink-0",
                    status === "pass" && "text-risk-low",
                    status === "violate" && "text-risk-high",
                    status === "pending" && "text-muted-foreground",
                  )}
                >
                  {status === "pass" ? "✓ 通过" : status === "violate" ? "✗ 违反" : "— 待扫描"}
                </span>
              </div>
              {rule.file ? (
                <p className="text-[10px] text-muted-foreground font-mono truncate">{rule.file}</p>
              ) : null}
              {rule.feedback ? (
                <p className="text-[10px] text-muted-foreground leading-relaxed">{rule.feedback}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
