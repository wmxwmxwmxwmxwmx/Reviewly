"use client"

import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DEFAULT_PRIORITY_SETTINGS,
  type PrioritySettings,
} from "@/features/prism/lib/governance-priority-settings"
import { cn } from "@/lib/utils"

type GovernanceAdvancedSettingsProps = {
  settings: PrioritySettings
  onSettingsChange: (next: PrioritySettings) => void
  ignoredText: string
  onIgnoredTextChange: (value: string) => void
  onSave: () => void
  ignoreOpen: boolean
  onIgnoreOpenChange: (open: boolean) => void
  scoringOpen: boolean
  onScoringOpenChange: (open: boolean) => void
}

export function GovernanceAdvancedSettings({
  settings,
  onSettingsChange,
  ignoredText,
  onIgnoredTextChange,
  onSave,
  ignoreOpen,
  onIgnoreOpenChange,
  scoringOpen,
  onScoringOpenChange,
}: GovernanceAdvancedSettingsProps) {
  return (
    <section aria-label="高级配置" className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-foreground">高级配置</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          忽略规则与评分策略，仅推荐高级管理员修改
        </p>
      </div>

      <Collapsible open={ignoreOpen} onOpenChange={onIgnoreOpenChange}>
        <div className="rounded-lg border border-border overflow-hidden bg-surface-2/30">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-3/40 transition-colors"
              aria-expanded={ignoreOpen}
            >
              <div>
                <span className="text-sm font-medium text-foreground">忽略规则</span>
                <span className="ml-2 text-[10px] text-muted-foreground uppercase tracking-wide">
                  高级
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  匹配标题或路径 glob，降低非核心 PR 的排序权重
                </p>
              </div>
              {ignoreOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
              <p className="text-[11px] text-muted-foreground">
                支持 glob 模式匹配（每行一条），例如 docs/**、README.md、*.md
              </p>
              <textarea
                className={cn(
                  "w-full min-h-[120px] px-3 py-2 rounded-md border border-border",
                  "bg-terminal-surface text-[12px] font-mono text-text-code",
                  "focus:outline-none focus:ring-1 focus:ring-ai-blue/40 focus:border-ai-blue/30",
                )}
                value={ignoredText}
                onChange={(e) => onIgnoredTextChange(e.target.value)}
                placeholder={"docs/**\nREADME.md\n*.md\nexamples/**"}
                spellCheck={false}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Collapsible open={scoringOpen} onOpenChange={onScoringOpenChange}>
        <div className="rounded-lg border border-border overflow-hidden bg-surface-2/30">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-3/40 transition-colors"
              aria-expanded={scoringOpen}
            >
              <div className="flex items-start gap-2">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <span className="text-sm font-medium text-foreground">风险评分策略</span>
                  <span className="ml-2 text-[10px] text-muted-foreground uppercase tracking-wide">
                    高级
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    用于影响 AI 风险排序优先级（本地存储）
                  </p>
                </div>
              </div>
              {scoringOpen ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 border-t border-border pt-3 space-y-4">
              <div>
                <p className="text-[11px] text-muted-foreground mb-2">风险等级权重</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                  {(["严重", "高", "中", "低"] as const).map((key) => (
                    <label key={key} className="space-y-1">
                      <span
                        className={cn(
                          "text-muted-foreground",
                          key === "严重" && "text-risk-critical",
                          key === "高" && "text-risk-high",
                          key === "中" && "text-risk-medium",
                          key === "低" && "text-ai-blue",
                        )}
                      >
                        风险 {key}
                      </span>
                      <input
                        type="number"
                        className="w-full h-8 px-2 rounded border border-border bg-surface-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ai-blue/40"
                        value={settings.riskWeights[key]}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            riskWeights: {
                              ...settings.riskWeights,
                              [key]: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-2">附加信号权重</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                  <label className="space-y-1">
                    <span className="text-muted-foreground">CI 失败 +</span>
                    <input
                      type="number"
                      className="w-full h-8 px-2 rounded border border-border bg-surface-2 focus:outline-none focus:ring-1 focus:ring-ai-blue/40"
                      value={settings.ciFailed}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          ciFailed: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Auth/Payment +</span>
                    <input
                      type="number"
                      className="w-full h-8 px-2 rounded border border-border bg-surface-2 focus:outline-none focus:ring-1 focus:ring-ai-blue/40"
                      value={settings.authPayment}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          authPayment: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">测试缺失 +</span>
                    <input
                      type="number"
                      className="w-full h-8 px-2 rounded border border-border bg-surface-2 focus:outline-none focus:ring-1 focus:ring-ai-blue/40"
                      value={settings.testsMissing}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          testsMissing: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                默认权重：严重 {DEFAULT_PRIORITY_SETTINGS.riskWeights.严重} / 高{" "}
                {DEFAULT_PRIORITY_SETTINGS.riskWeights.高} / CI +
                {DEFAULT_PRIORITY_SETTINGS.ciFailed}
              </p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={onSave}>
          保存高级配置
        </Button>
      </div>
    </section>
  )
}
