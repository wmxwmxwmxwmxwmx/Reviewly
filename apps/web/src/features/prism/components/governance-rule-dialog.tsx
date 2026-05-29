"use client"

import { useEffect, useState } from "react"
import type { GovernanceMatchType, GovernanceRule, GovernanceRuleInput } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const MATCH_TYPES: { value: GovernanceMatchType; label: string; hint: string }[] = [
  { value: "keyword", label: "关键词", hint: "在 Diff / findings 文本中匹配" },
  { value: "file_pattern", label: "文件路径", hint: "如 **/payment/**" },
  { value: "finding", label: "扫描结果", hint: "按 findings 类型与严重级别" },
  { value: "any", label: "组合（任一命中）", hint: "关键词、路径、findings 任一满足即违规" },
]

function toList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function fromList(list?: string[]): string {
  return (list ?? []).join(", ")
}

type GovernanceRuleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: GovernanceRule | null
  onSubmit: (input: GovernanceRuleInput) => Promise<void>
}

export function GovernanceRuleDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: GovernanceRuleDialogProps) {
  const [rule, setRule] = useState("")
  const [description, setDescription] = useState("")
  const [severity, setSeverity] = useState<GovernanceRuleInput["severity"]>("medium")
  const [matchType, setMatchType] = useState<GovernanceMatchType>("keyword")
  const [keywords, setKeywords] = useState("")
  const [filePatterns, setFilePatterns] = useState("")
  const [findingTypes, setFindingTypes] = useState("")
  const [findingSeverities, setFindingSeverities] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setRule(initial?.rule ?? "")
    setDescription(initial?.description ?? "")
    setSeverity(initial?.severity ?? "medium")
    setMatchType(initial?.matchType ?? "keyword")
    setKeywords(fromList(initial?.keywords))
    setFilePatterns(fromList(initial?.filePatterns))
    setFindingTypes(fromList(initial?.findingTypes))
    setFindingSeverities(fromList(initial?.findingSeverities))
    setEnabled(initial?.enabled ?? true)
    setFormError(null)
  }, [open, initial])

  const handleSave = async () => {
    if (!rule.trim()) {
      setFormError("请填写规则描述")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await onSubmit({
        rule: rule.trim(),
        description: description.trim() || undefined,
        severity,
        matchType,
        keywords: toList(keywords),
        filePatterns: toList(filePatterns),
        findingTypes: toList(findingTypes) as GovernanceRuleInput["findingTypes"],
        findingSeverities: toList(findingSeverities) as GovernanceRuleInput["findingSeverities"],
        enabled,
      })
      onOpenChange(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-panel border-border">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑治理规则" : "新建治理规则"}</DialogTitle>
          <DialogDescription>
            分析完成后将自动对照 Diff 与 findings 进行匹配，并在 AI 面板「治理」标签给出反馈。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">规则描述 *</span>
            <Input
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              placeholder="例如：禁止在支付模块打印 Token"
              className="bg-surface-2 border-border"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">说明（可选）</span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-surface-2 border-border"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">严重级别</span>
              <select
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as GovernanceRuleInput["severity"])
                }
                className="w-full h-9 px-2 rounded-md bg-surface-2 border border-border text-sm"
              >
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs text-muted-foreground">启用</span>
            </label>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">匹配方式</span>
            <div className="grid grid-cols-2 gap-1.5">
              {MATCH_TYPES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMatchType(m.value)}
                  className={cn(
                    "text-left px-2 py-1.5 rounded-md border text-[11px] transition-colors",
                    matchType === m.value
                      ? "border-ai-blue bg-[oklch(0.62_0.19_240/0.12)] text-foreground"
                      : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="opacity-70">{m.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {(matchType === "keyword" || matchType === "any") && (
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">关键词（逗号分隔）</span>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="token, password, 密钥"
                className="bg-surface-2 border-border font-mono text-xs"
              />
            </label>
          )}

          {(matchType === "file_pattern" || matchType === "any") && (
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">文件路径模式（逗号分隔）</span>
              <Input
                value={filePatterns}
                onChange={(e) => setFilePatterns(e.target.value)}
                placeholder="**/payment/**, **/*.env"
                className="bg-surface-2 border-border font-mono text-xs"
              />
            </label>
          )}

          {(matchType === "finding" || matchType === "any") && (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Findings 类型</span>
                <Input
                  value={findingTypes}
                  onChange={(e) => setFindingTypes(e.target.value)}
                  placeholder="security, performance"
                  className="bg-surface-2 border-border font-mono text-xs"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Findings 严重级别</span>
                <Input
                  value={findingSeverities}
                  onChange={(e) => setFindingSeverities(e.target.value)}
                  placeholder="critical, high"
                  className="bg-surface-2 border-border font-mono text-xs"
                />
              </label>
            </>
          )}

          {formError && <p className="text-xs text-risk-high">{formError}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
