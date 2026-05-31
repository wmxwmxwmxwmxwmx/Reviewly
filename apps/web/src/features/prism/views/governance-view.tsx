"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react"
import type { GovernanceRule } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { GovernanceRuleDialog } from "@/features/prism/components/governance-rule-dialog"
import { useGovernance } from "@/hooks/use-governance"
import { useReviewInbox } from "@/hooks/use-review-inbox"
import {
  DEFAULT_PRIORITY_SETTINGS,
  readPrioritySettings,
  writePrioritySettings,
  type PrioritySettings,
} from "@/features/prism/lib/governance-priority-settings"
import {
  clearDeferred,
  dispatchRescore,
  readStore,
  setIgnoredPatterns,
} from "@/features/prism/lib/review-task-store"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

const matchTypeLabel: Record<string, string> = {
  keyword: "关键词",
  file_pattern: "路径",
  finding: "Findings",
  any: "组合",
}

export function GovernanceView() {
  const { navigate, returnView, returnPrId } = useNavigation()
  const { rules, loading, error, addRule, editRule, removeRule } = useGovernance({
    includeDisabled: true,
  })
  const { allItems } = useReviewInbox()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GovernanceRule | null>(null)
  const [settings, setSettings] = useState<PrioritySettings>(() => readPrioritySettings())
  const [ignoredText, setIgnoredText] = useState(() => readStore().ignoredPatterns.join("\n"))

  useEffect(() => {
    setSettings(readPrioritySettings())
    setIgnoredText(readStore().ignoredPatterns.join("\n"))
  }, [])

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

  const saveSettings = useCallback(() => {
    writePrioritySettings(settings)
    const patterns = ignoredText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
    setIgnoredPatterns(patterns)
    window.dispatchEvent(new CustomEvent("prism:rescore"))
  }, [settings, ignoredText])

  const handleRescoreAll = useCallback(() => {
    clearDeferred()
    dispatchRescore()
  }, [])

  const handleRestoreAllDone = useCallback(() => {
    if (!window.confirm("确定清除所有延后标记并刷新收件箱排序？")) return
    clearDeferred()
    dispatchRescore()
  }, [])

  const handleBack = () => {
    const view = returnView ?? "ai-review"
    if (view === "ai-review") {
      navigate("ai-review", {
        prId: returnPrId ?? undefined,
        reviewTab: "inbox",
      })
      return
    }
    navigate(view)
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">工程治理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.governance}</p>
        </div>
        <Button type="button" size="sm" onClick={openCreate} className="gap-1.5 shrink-0">
          <Plus className="w-3.5 h-3.5" />
          新建规则
        </Button>
      </div>

      {error && <p className="text-sm text-risk-high">{error}</p>}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border">
          <span className="text-sm font-medium text-foreground">优先级权重配置</span>
          <p className="text-xs text-muted-foreground mt-0.5">影响 Review Center AI 排序（本地存储）</p>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
          {(["严重", "高", "中", "低"] as const).map((key) => (
            <label key={key} className="space-y-1">
              <span className="text-muted-foreground">风险 {key}</span>
              <input
                type="number"
                className="w-full h-8 px-2 rounded border border-border bg-surface-2 text-foreground"
                value={settings.riskWeights[key]}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    riskWeights: { ...s.riskWeights, [key]: Number(e.target.value) || 0 },
                  }))
                }
              />
            </label>
          ))}
          <label className="space-y-1">
            <span className="text-muted-foreground">CI 失败 +</span>
            <input
              type="number"
              className="w-full h-8 px-2 rounded border border-border bg-surface-2"
              value={settings.ciFailed}
              onChange={(e) => setSettings((s) => ({ ...s, ciFailed: Number(e.target.value) || 0 }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Auth/Payment +</span>
            <input
              type="number"
              className="w-full h-8 px-2 rounded border border-border bg-surface-2"
              value={settings.authPayment}
              onChange={(e) =>
                setSettings((s) => ({ ...s, authPayment: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">测试缺失 +</span>
            <input
              type="number"
              className="w-full h-8 px-2 rounded border border-border bg-surface-2"
              value={settings.testsMissing}
              onChange={(e) =>
                setSettings((s) => ({ ...s, testsMissing: Number(e.target.value) || 0 }))
              }
            />
          </label>
        </div>
        <div className="px-4 pb-4 space-y-2">
          <label className="text-[12px] text-muted-foreground block">忽略规则（每行一个关键词，匹配标题）</label>
          <textarea
            className="w-full min-h-[72px] px-2 py-1.5 rounded border border-border bg-surface-2 text-[12px] font-mono"
            value={ignoredText}
            onChange={(e) => setIgnoredText(e.target.value)}
            placeholder="docs:&#10;readme&#10;format"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={saveSettings}>
              保存权重与忽略规则
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleRescoreAll} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              重新评估所有 PR
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleRestoreAllDone} className="gap-1.5">
              ↩ 清除延后标记
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            纳管 PR：{allItems.length} 条 · 未查阅：
            {allItems.filter((i) => i.attentionState === "unread").length} 条 · 默认权重见规范（严重
            {DEFAULT_PRIORITY_SETTINGS.riskWeights.严重} / CI +{DEFAULT_PRIORITY_SETTINGS.ciFailed}）
          </p>
        </div>
      </div>

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
