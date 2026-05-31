"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import type { GovernanceRule } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GovernanceRuleDialog } from "@/features/prism/components/governance-rule-dialog"
import { GovernanceAdvancedSettings } from "@/features/prism/views/governance/governance-advanced-settings"
import { GovernanceOverview } from "@/features/prism/views/governance/governance-overview"
import { GovernanceRulesSection } from "@/features/prism/views/governance/governance-rules-section"
import {
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
import { useGovernance } from "@/hooks/use-governance"
import { useGovernanceOverview } from "@/hooks/use-governance-overview"
import { useReviewInbox } from "@/hooks/use-review-inbox"
import { useToast } from "@/hooks/use-toast"
import { formatPrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"

export function GovernanceView() {
  const { returnView, returnPrId, navigate } = useNavigation()
  const { toast } = useToast()
  const { rules, loading, error, addRule, editRule, setRuleEnabled, removeRule } = useGovernance({
    includeDisabled: true,
  })
  const { allItems } = useReviewInbox()
  const { loading: overviewLoading, hitCountByRule, metrics } =
    useGovernanceOverview(allItems)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GovernanceRule | null>(null)
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null)
  const [settings, setSettings] = useState<PrioritySettings>(() => readPrioritySettings())
  const [ignoredText, setIgnoredText] = useState(() => readStore().ignoredPatterns.join("\n"))
  const [ignoreOpen, setIgnoreOpen] = useState(false)
  const [scoringOpen, setScoringOpen] = useState(false)

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
    try {
      await removeRule(rule.id)
      toast({ title: "规则已删除", description: rule.rule })
    } catch (err: unknown) {
      toast({
        title: "删除失败",
        description: formatPrismApiError(err, "请稍后重试"),
        variant: "destructive",
      })
    }
  }

  const handleToggleEnabled = async (rule: GovernanceRule, enabled: boolean) => {
    const previousEnabled = rule.enabled !== false
    if (enabled === previousEnabled) return

    setTogglingRuleId(rule.id)
    try {
      await setRuleEnabled(rule.id, enabled, previousEnabled)
      toast({
        title: enabled ? "规则已启用" : "规则已停用",
        description: rule.rule,
      })
    } catch (err: unknown) {
      toast({
        title: "状态更新失败",
        description: formatPrismApiError(err, "请稍后重试"),
        variant: "destructive",
      })
    } finally {
      setTogglingRuleId(null)
    }
  }

  const persistAdvancedSettings = useCallback(() => {
    writePrioritySettings(settings)
    const patterns = ignoredText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
    setIgnoredPatterns(patterns)
    dispatchRescore()
  }, [settings, ignoredText])

  const saveSettings = useCallback(() => {
    persistAdvancedSettings()
    toast({
      title: "配置已保存",
      description: "评分策略与忽略规则已更新，队列将重新排序",
    })
  }, [persistAdvancedSettings, toast])

  const handleRescoreAll = useCallback(() => {
    clearDeferred()
    dispatchRescore()
    toast({ title: "已重新评估", description: "所有 PR 优先级队列已刷新" })
  }, [toast])

  const handleRebuildIndex = useCallback(() => {
    persistAdvancedSettings()
    toast({ title: "治理索引已重建", description: "已基于当前配置重建排序索引" })
  }, [persistAdvancedSettings, toast])

  const handleClearDeferred = useCallback(() => {
    if (!window.confirm("确定清除所有延后标记并刷新收件箱排序？")) return
    clearDeferred()
    dispatchRescore()
    toast({ title: "已刷新", description: "延后标记已清除，收件箱排序已更新" })
  }, [toast])

  const showBack = returnView != null

  const backLabel = useMemo(() => {
    if (!returnView) return zh.governance.backToPrevious
    if (returnView === "ai-review") {
      return returnPrId ? zh.governance.backToAiReview : zh.governance.backToReviewCenter
    }
    return zh.governance.backToPrevious
  }, [returnView, returnPrId])

  const handleBack = useCallback(() => {
    if (!returnView) return
    if (returnView === "ai-review") {
      navigate(
        "ai-review",
        returnPrId ? { prId: returnPrId } : { aiReviewList: true },
      )
      return
    }
    navigate(returnView)
  }, [navigate, returnView, returnPrId])

  return (
    <div className="p-5 space-y-5 min-w-0 w-full">
      <div className="flex items-start justify-between gap-3 pb-1 border-b border-border">
        <div className="min-w-0">
          {showBack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground -ml-2 mb-2 gap-1.5 h-8 px-2"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {backLabel}
            </Button>
          ) : null}
          <h1 className="text-lg font-semibold text-foreground">工程治理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.governance}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="shrink-0">
              更多操作
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleRescoreAll}>
              重新评估所有 PR
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRebuildIndex}>
              重建治理索引
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleClearDeferred}>
              清除延后标记
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <p className="text-sm text-risk-high rounded-lg border border-risk-high/30 bg-risk-high/10 px-4 py-3">
          {error}
        </p>
      )}

      <GovernanceOverview
        enabledRules={loading ? 0 : enabledRules.length}
        metrics={metrics}
        loading={overviewLoading || loading}
      />

      <GovernanceRulesSection
        rules={rules}
        loading={loading}
        hitCountByRule={hitCountByRule}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggleEnabled={handleToggleEnabled}
        togglingRuleId={togglingRuleId}
      />

      <GovernanceAdvancedSettings
        settings={settings}
        onSettingsChange={setSettings}
        ignoredText={ignoredText}
        onIgnoredTextChange={setIgnoredText}
        onSave={saveSettings}
        ignoreOpen={ignoreOpen}
        onIgnoreOpenChange={setIgnoreOpen}
        scoringOpen={scoringOpen}
        onScoringOpenChange={setScoringOpen}
      />

      <GovernanceRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={async (input) => {
          try {
            if (editing) {
              await editRule(editing.id, input)
              toast({ title: "规则已更新", description: input.rule })
            } else {
              await addRule(input)
              toast({ title: "规则已创建", description: input.rule })
            }
          } catch (err: unknown) {
            toast({
              title: editing ? "更新失败" : "创建失败",
              description: formatPrismApiError(err, "请稍后重试"),
              variant: "destructive",
            })
            throw err
          }
        }}
      />
    </div>
  )
}
