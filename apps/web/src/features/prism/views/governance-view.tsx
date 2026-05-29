"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { GitBranch, CheckCircle2, AlertTriangle, Plus, Pencil, Trash2 } from "lucide-react"
import type { GovernanceRule } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import { GovernanceRuleDialog } from "@/features/prism/components/governance-rule-dialog"
import { useGovernance } from "@/hooks/use-governance"
import { cn } from "@/lib/utils"

const matchTypeLabel: Record<string, string> = {
  keyword: "关键词",
  file_pattern: "路径",
  finding: "Findings",
  any: "组合",
}

export function GovernanceView() {
  const { rules, loading, error, addRule, editRule, removeRule } = useGovernance({
    includeDisabled: true,
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GovernanceRule | null>(null)

  const enabledRules = rules.filter((r) => r.enabled !== false)

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (rule: GovernanceRule) => {
    setEditing(rule)
    setDialogOpen(true)
  }

  const handleDelete = async (rule: GovernanceRule) => {
    if (!window.confirm(`确定删除规则「${rule.rule}」？`)) return
    await removeRule(rule.id)
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">工程治理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            自定义门禁规则；PR 分析完成后自动匹配 Diff 与 findings
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate} className="gap-1.5 shrink-0">
          <Plus className="w-3.5 h-3.5" />
          新建规则
        </Button>
      </div>

      {error && <p className="text-sm text-risk-high">{error}</p>}

      <div className="p-4 rounded-lg bg-surface-2 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-semibold text-foreground">
              {loading ? "—" : enabledRules.length}
            </span>
            <span className="text-sm text-muted-foreground ml-2">条启用规则</span>
          </div>
          <div className="text-xs text-muted-foreground">共 {rules.length} 条（含停用）</div>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">规则列表</span>
        </div>
        <div className="divide-y divide-border">
          {loading && (
            <p className="px-4 py-6 text-sm text-muted-foreground">加载中…</p>
          )}
          {!loading && rules.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">暂无规则，点击「新建规则」添加。</p>
          )}
          {!loading &&
            rules.map((rule, idx) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="px-4 py-3 flex items-start gap-3"
              >
                <div
                  className={cn(
                    "p-1.5 rounded mt-0.5",
                    rule.enabled === false
                      ? "bg-surface-3"
                      : "bg-[oklch(0.62_0.17_148/0.15)]",
                  )}
                >
                  {rule.enabled === false ? (
                    <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-risk-low" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground font-medium">{rule.rule}</div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">
                      {matchTypeLabel[rule.matchType ?? "keyword"] ?? rule.matchType}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">
                      {rule.severity}
                    </span>
                    {rule.enabled === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-risk-medium">
                        已停用
                      </span>
                    )}
                  </div>
                  {(rule.keywords?.length ?? 0) > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                      关键词: {rule.keywords?.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(rule)}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                    aria-label="编辑"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(rule)}
                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-risk-high"
                    aria-label="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
        </div>
      </div>

      <GovernanceRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={async (input) => {
          if (editing) {
            await editRule(editing.id, input)
          } else {
            await addRule(input)
          }
        }}
      />
    </div>
  )
}
