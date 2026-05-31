"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { GitBranch, Pencil, Plus, Trash2 } from "lucide-react"
import type { GovernanceRule } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  matchTypeLabel,
  severityMeta,
} from "@/features/prism/views/governance/governance-shared"
import { cn } from "@/lib/utils"

type GovernanceRulesSectionProps = {
  rules: GovernanceRule[]
  loading: boolean
  hitCountByRule: Map<string, number>
  onCreate: () => void
  onEdit: (rule: GovernanceRule) => void
  onDelete: (rule: GovernanceRule) => void
  onToggleEnabled: (rule: GovernanceRule, enabled: boolean) => void
  togglingRuleId: string | null
}

export function GovernanceRulesSection({
  rules,
  loading,
  hitCountByRule,
  onCreate,
  onEdit,
  onDelete,
  onToggleEnabled,
  togglingRuleId,
}: GovernanceRulesSectionProps) {
  const enabledCount = rules.filter((r) => r.enabled !== false).length
  const disabledCount = rules.length - enabledCount

  return (
    <section aria-label="规则管理" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">规则管理</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            定义团队代码规范与自动化治理策略
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
            <span>
              共 <span className="text-foreground font-medium">{rules.length}</span> 条规则
            </span>
            <span className="text-border">·</span>
            <span>
              启用{" "}
              <span className="text-risk-low font-medium">{enabledCount}</span>
            </span>
            <span className="text-border">·</span>
            <span>
              停用{" "}
              <span className="text-muted-foreground font-medium">{disabledCount}</span>
            </span>
          </div>
        </div>
        <Button type="button" size="sm" onClick={onCreate} className="gap-1.5 shrink-0">
          <Plus className="w-3.5 h-3.5" />
          新建规则
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-surface-2/50">
        <div className="px-4 py-2.5 bg-surface-2 border-b border-border flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-ai-blue" />
          <span className="text-xs font-medium text-foreground">治理规则列表</span>
        </div>

        <div className="hidden md:grid md:grid-cols-[minmax(0,1.6fr)_88px_72px_72px_88px_96px] gap-2 px-4 py-2 border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>规则名称</span>
          <span>类型</span>
          <span>风险等级</span>
          <span>命中</span>
          <span>状态</span>
          <span className="text-right">操作</span>
        </div>

        <div className="divide-y divide-border">
          {loading && (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">加载中…</p>
          )}
          {!loading && rules.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">暂无规则</p>
              <p className="text-xs text-muted-foreground mt-1">
                点击「新建规则」为团队添加第一条治理策略
              </p>
            </div>
          )}
          {!loading &&
            rules.map((rule, idx) => {
              const severity = severityMeta[rule.severity] ?? severityMeta.medium
              const hits = hitCountByRule.get(rule.id) ?? 0
              const isEnabled = rule.enabled !== false
              const isToggling = togglingRuleId === rule.id

              return (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="px-4 py-3 hover:bg-surface-3/40 transition-colors"
                >
                  <div className="md:grid md:grid-cols-[minmax(0,1.6fr)_88px_72px_72px_88px_96px] md:items-center gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-1.5 rounded-full shrink-0",
                            isEnabled ? severity.dot : "bg-muted-foreground/40",
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "text-sm font-medium truncate",
                            isEnabled ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {rule.rule}
                        </span>
                      </div>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 md:pl-3.5">
                          {rule.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2 md:hidden">
                        <RuleTag>{matchTypeLabel[rule.matchType ?? "keyword"] ?? rule.matchType}</RuleTag>
                        <RuleTag className={severity.badge}>{severity.label}</RuleTag>
                        <RuleTag>命中 {hits}</RuleTag>
                      </div>
                    </div>

                    <div className="hidden md:block">
                      <RuleTag>{matchTypeLabel[rule.matchType ?? "keyword"] ?? rule.matchType}</RuleTag>
                    </div>
                    <div className="hidden md:block">
                      <RuleTag className={severity.badge}>{severity.label}</RuleTag>
                    </div>
                    <div className="hidden md:block">
                      <span className="text-xs tabular-nums text-foreground">{hits}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 md:mt-0">
                      <Switch
                        checked={isEnabled}
                        disabled={isToggling}
                        onCheckedChange={(checked) => {
                          const nextEnabled = checked === true
                          if (nextEnabled === isEnabled) return
                          void onToggleEnabled(rule, nextEnabled)
                        }}
                        aria-label={isEnabled ? "停用规则" : "启用规则"}
                      />
                      <span className="text-[11px] text-muted-foreground md:hidden">
                        {isEnabled ? "启用" : "停用"}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-2 md:mt-0">
                      <button
                        type="button"
                        onClick={() => onEdit(rule)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="编辑"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(rule)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-risk-high transition-colors"
                        aria-label="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
        </div>
      </div>
    </section>
  )
}

function RuleTag({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border border-border bg-surface-3 text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}
