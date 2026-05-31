"use client"

import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { PrioritySettings } from "@/features/prism/lib/governance-priority-settings"
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

const inputClass =
  "w-full h-8 px-2 rounded border border-border bg-surface-2 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ai-blue/40"

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
    <section aria-label="高级配置" className="space-y-2">
      <h2 className="text-sm font-medium text-foreground">高级配置</h2>

      <div className="rounded-lg border border-border overflow-hidden bg-surface-2/50 divide-y divide-border">
        <Collapsible open={ignoreOpen} onOpenChange={onIgnoreOpenChange}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-3/30 transition-colors"
              aria-expanded={ignoreOpen}
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">忽略规则</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  glob 匹配 PR 标题或路径，降低非核心变更的排序权重
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                  ignoreOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-1 border-t border-border bg-surface-2/30">
              <textarea
                className={cn(
                  "w-full min-h-[112px] px-3 py-2 rounded-md border border-border mt-3",
                  "bg-terminal-surface text-xs font-mono text-text-code",
                  "focus:outline-none focus:ring-1 focus:ring-ai-blue/40 focus:border-ai-blue/30",
                )}
                value={ignoredText}
                onChange={(e) => onIgnoredTextChange(e.target.value)}
                placeholder={"docs/**\nREADME.md\n*.md"}
                spellCheck={false}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={scoringOpen} onOpenChange={onScoringOpenChange}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-3/30 transition-colors"
              aria-expanded={scoringOpen}
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">风险评分策略</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  调整收件箱 PR 排序权重（本地存储）
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                  scoringOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-3 border-t border-border bg-surface-2/30 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">风险等级权重</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(["严重", "高", "中", "低"] as const).map((key) => (
                    <label key={key} className="space-y-1 block">
                      <span className="text-xs text-muted-foreground">{key}</span>
                      <input
                        type="number"
                        className={inputClass}
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
                <p className="text-xs text-muted-foreground mb-2">附加信号</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="space-y-1 block">
                    <span className="text-xs text-muted-foreground">CI 失败</span>
                    <input
                      type="number"
                      className={inputClass}
                      value={settings.ciFailed}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          ciFailed: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-xs text-muted-foreground">Auth / Payment</span>
                    <input
                      type="number"
                      className={inputClass}
                      value={settings.authPayment}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          authPayment: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-xs text-muted-foreground">测试缺失</span>
                    <input
                      type="number"
                      className={inputClass}
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
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex justify-end pt-1">
        <Button type="button" size="sm" variant="outline" onClick={onSave}>
          保存配置
        </Button>
      </div>
    </section>
  )
}
