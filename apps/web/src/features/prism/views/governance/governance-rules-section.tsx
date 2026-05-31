"use client"

import { Pencil, Trash2 } from "lucide-react"
import type { GovernanceRule } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import { GovernanceRuleSwitch } from "@/features/prism/views/governance/governance-rule-switch"
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

const COLS =
  "md:grid md:grid-cols-[minmax(0,1.8fr)_80px_72px_56px_120px_72px] md:items-center md:gap-3"

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
    <section aria-label="规则管理" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-foreground">规则管理</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading
              ? "加载中…"
              : `共 ${rules.length} 条，启用 ${enabledCount}，停用 ${disabledCount}`}
          </p>
        </div>
        <Button type="button" size="sm" onClick={onCreate} className="shrink-0">
          新建规则
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-surface-2/50">
        <div
          className={cn(
            "hidden md:grid px-4 py-2 border-b border-border bg-surface-2",
            "text-xs text-muted-foreground",
            COLS,
          )}
        >
          <span>规则名称</span>
          <span>类型</span>
          <span>风险等级</span>
          <span>命中</span>
          <span>状态</span>
          <span className="text-right">操作</span>
        </div>

        <div className="divide-y divide-border">
          {loading && (
            <p className="px-4 py-10 text-sm text-muted-foreground text-center">加载中…</p>
          )}
          {!loading && rules.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-muted-foreground">暂无治理规则</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onCreate}>
                新建规则
              </Button>
            </div>
          )}
          {!loading &&
            rules.map((rule) => {
              const severity = severityMeta[rule.severity] ?? severityMeta.medium
              const hits = hitCountByRule.get(rule.id) ?? 0
              const isEnabled = rule.enabled !== false
              const isToggling = togglingRuleId === rule.id
              const matchLabel =
                matchTypeLabel[rule.matchType ?? "keyword"] ?? rule.matchType ?? "—"

              return (
                <div
                  key={rule.id}
                  className={cn("px-4 py-3 hover:bg-surface-3/30 transition-colors", COLS)}
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        isEnabled ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {rule.rule}
                    </p>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {rule.description}
                      </p>
                    )}
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs md:hidden">
                      <div>
                        <dt className="text-muted-foreground">类型</dt>
                        <dd className="text-foreground mt-0.5">{matchLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">风险</dt>
                        <dd className={cn("mt-0.5 font-medium", severity.text)}>
                          {severity.label}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">命中</dt>
                        <dd className="text-foreground tabular-nums mt-0.5">{hits}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">状态</dt>
                        <dd className="text-foreground mt-0.5">{isEnabled ? "启用" : "停用"}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="hidden md:block text-xs text-foreground">{matchLabel}</div>
                  <div className={cn("hidden md:block text-xs font-medium", severity.text)}>
                    {severity.label}
                  </div>
                  <div className="hidden md:block text-xs tabular-nums text-foreground">
                    {hits}
                  </div>
                  <div className="flex items-center gap-2.5 mt-3 md:mt-0 min-w-[108px]">
                    <GovernanceRuleSwitch
                      checked={isEnabled}
                      disabled={isToggling}
                      onCheckedChange={(checked) => {
                        const nextEnabled = checked === true
                        if (nextEnabled === isEnabled) return
                        void onToggleEnabled(rule, nextEnabled)
                      }}
                      aria-label={isEnabled ? "停用规则" : "启用规则"}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        isEnabled ? "text-risk-low" : "text-muted-foreground",
                      )}
                    >
                      {isEnabled ? "启用" : "停用"}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-0.5 mt-2 md:mt-0">
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
              )
            })}
        </div>
      </div>
    </section>
  )
}
