"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Bot, User, Bell, Shield, Save, Check, KeyRound } from "lucide-react"
import type { SessionTimeoutMinutes } from "@reviewly/shared"

import {
  AI_PROVIDER_OPTIONS,
  type AIProvider,
  useAISettings,
} from "@/features/prism/contexts/ai-settings-context"
import { useSecuritySettings } from "@/features/prism/contexts/security-settings-context"
import { TwoFactorPinDialog } from "@/features/prism/components/two-factor-pin-dialog"
import { SESSION_TIMEOUT_OPTIONS } from "@/features/prism/lib/security-settings"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

type SettingItem =
  | { label: string; value: string; type: "text" }
  | { label: string; value: boolean; type: "toggle"; key: string }

const staticSections: { icon: typeof User; title: string; items: SettingItem[] }[] = [
  {
    icon: User,
    title: "账户设置",
    items: [
      { label: "用户名", value: "zhang.wei", type: "text" },
      { label: "邮箱", value: "zhang.wei@company.com", type: "text" },
    ],
  },
  {
    icon: Bell,
    title: "通知设置",
    items: [
      { label: "PR 评审通知", value: true, type: "toggle", key: "pr-notify" },
      { label: "安全告警通知", value: true, type: "toggle", key: "security-notify" },
      { label: "每日摘要邮件", value: false, type: "toggle", key: "daily-digest" },
    ],
  },
]

export function SettingsView() {
  const { settings, providerLabel, hasApiKey, maskedApiKey, monthlyUsage, clearUsage, updateSettings } =
    useAISettings()
  const {
    security,
    hydrated: securityHydrated,
    saving: securitySaving,
    saveError,
    hasTwoFactorPin,
    updateSecurity,
    saveSecurity,
    setTwoFactorPin,
    clearTwoFactorPin,
    verifyPin,
  } = useSecuritySettings()

  const [toggles, setToggles] = useState<Record<string, boolean>>({
    "pr-notify": true,
    "security-notify": true,
    "daily-digest": false,
  })
  const [aiForm, setAiForm] = useState(settings)
  const [saved, setSaved] = useState(false)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [pinDialogMode, setPinDialogMode] = useState<"setup" | "disable">("setup")

  useEffect(() => {
    setAiForm(settings)
  }, [settings])

  const handleToggle = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const handleTwoFactorToggle = () => {
    if (!security.twoFactorEnabled) {
      setPinDialogMode("setup")
      setPinDialogOpen(true)
      return
    }

    if (hasTwoFactorPin) {
      setPinDialogMode("disable")
      setPinDialogOpen(true)
      return
    }

    updateSecurity({ twoFactorEnabled: false })
    setSaved(false)
  }

  const handlePinDialogConfirm = async (pin: string) => {
    if (pinDialogMode === "setup") {
      await setTwoFactorPin(pin)
      updateSecurity({ twoFactorEnabled: true })
      const ok = await saveSecurity({ twoFactorEnabled: true })
      if (!ok) {
        throw new Error("保存双因素认证设置失败")
      }
      setSaved(false)
      return
    }

    if (!(await verifyPin(pin))) {
      throw new Error("验证码错误")
    }

    clearTwoFactorPin()
    updateSecurity({ twoFactorEnabled: false })
    const ok = await saveSecurity({ twoFactorEnabled: false })
    if (!ok) {
      throw new Error("保存双因素认证设置失败")
    }
    setSaved(false)
  }

  const handleProviderChange = (provider: AIProvider) => {
    const option = AI_PROVIDER_OPTIONS.find((item) => item.value === provider)
    setAiForm((current) => ({
      ...current,
      provider,
      model: option?.defaultModel ?? current.model,
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    updateSettings(aiForm)
    const securityOk = await saveSecurity()
    if (securityOk) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const isSaving = securitySaving

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">系统设置</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.settings}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-border overflow-hidden bg-panel/40"
      >
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <Bot className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">AI 模型设置</span>
          <span
            className={cn(
              "ml-auto text-[11px] px-2 py-0.5 rounded-full border",
              hasApiKey
                ? "text-risk-low border-risk-low/30 bg-risk-low/10"
                : "text-risk-medium border-risk-medium/30 bg-risk-medium/10",
            )}
          >
            {hasApiKey ? `已配置 ${maskedApiKey}` : `未配置 ${zh.settings.apiKey}`}
          </span>
        </div>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <label className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">模型供应商</span>
            <select
              value={aiForm.provider}
              onChange={(event) => handleProviderChange(event.target.value as AIProvider)}
              className="w-full h-10 rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus:border-ai-blue focus:ring-2 focus:ring-ai-blue/20"
            >
              {AI_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-panel text-foreground">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">模型名称</span>
            <input
              value={aiForm.model}
              onChange={(event) => {
                setAiForm((current) => ({ ...current, model: event.target.value }))
                setSaved(false)
              }}
              placeholder="例如 claude-opus-4.6"
              className="w-full h-10 rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ai-blue focus:ring-2 focus:ring-ai-blue/20"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">{zh.settings.apiKey}</span>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={aiForm.apiKey}
                onChange={(event) => {
                  setAiForm((current) => ({ ...current, apiKey: event.target.value }))
                  setSaved(false)
                }}
                placeholder={`输入供应商 ${zh.settings.apiKey}`}
                className="w-full h-10 rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ai-blue focus:ring-2 focus:ring-ai-blue/20"
              />
            </div>
          </label>
        </div>
        <div className="px-4 pb-4 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            当前侧边栏左下角会同步显示：<span className="text-foreground">{providerLabel}</span> ·{" "}
            <span className="font-mono text-ai-blue">{aiForm.model || "未选择模型"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              {zh.settings.monthlyTokens} {monthlyUsage.totalTokens.toLocaleString()} {zh.settings.tokensUnit} · ¥
              {monthlyUsage.costCny.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={clearUsage}
              className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-risk-medium/40 hover:text-risk-medium"
            >
              清空用量
            </button>
          </div>
        </div>
      </motion.div>

      {staticSections.map((section, idx) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: (idx + 1) * 0.05 }}
          className="rounded-lg border border-border overflow-hidden"
        >
          <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
            <section.icon className="w-4 h-4 text-ai-blue" />
            <span className="text-sm font-medium text-foreground">{section.title}</span>
          </div>
          <div className="divide-y divide-border">
            {section.items.map((item) => (
              <div key={item.label} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-foreground">{item.label}</span>
                {item.type === "text" && (
                  <span className="text-sm text-muted-foreground">{item.value as string}</span>
                )}
                {item.type === "toggle" && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={toggles[item.key]}
                    onClick={() => handleToggle(item.key)}
                    className={cn(
                      "w-10 h-5 rounded-full transition-colors relative",
                      toggles[item.key] ? "bg-ai-blue" : "bg-surface-4",
                    )}
                  >
                    <motion.div
                      className="w-4 h-4 rounded-full bg-white absolute top-0.5"
                      animate={{ left: toggles[item.key] ? "calc(100% - 18px)" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-lg border border-border overflow-hidden"
      >
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">安全设置</span>
          {security.twoFactorEnabled && (
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full border text-risk-low border-risk-low/30 bg-risk-low/10">
              2FA 已启用
            </span>
          )}
        </div>
        <div className="divide-y divide-border">
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <span className="text-sm text-foreground">双因素认证</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                启用后，会话锁定需输入 6 位 PIN 解锁
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={security.twoFactorEnabled}
              disabled={!securityHydrated}
              onClick={handleTwoFactorToggle}
              className={cn(
                "w-10 h-5 rounded-full transition-colors relative shrink-0",
                security.twoFactorEnabled ? "bg-ai-blue" : "bg-surface-4",
                !securityHydrated && "opacity-50 cursor-not-allowed",
              )}
            >
              <motion.div
                className="w-4 h-4 rounded-full bg-white absolute top-0.5"
                animate={{ left: security.twoFactorEnabled ? "calc(100% - 18px)" : "2px" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <span className="text-sm text-foreground">会话超时</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                无操作达到设定时间后自动锁定会话
              </p>
            </div>
            <select
              value={security.sessionTimeoutMinutes}
              disabled={!securityHydrated}
              onChange={(event) => {
                updateSecurity({
                  sessionTimeoutMinutes: Number(event.target.value) as SessionTimeoutMinutes,
                })
                setSaved(false)
              }}
              className="h-9 min-w-[7rem] rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus:border-ai-blue focus:ring-2 focus:ring-ai-blue/20 disabled:opacity-50"
            >
              {SESSION_TIMEOUT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-panel text-foreground">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {saveError && <p className="text-xs text-risk-high">{saveError}</p>}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isSaving}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-ai-blue rounded-md hover:bg-sky-300 transition-colors disabled:opacity-50"
      >
        {saved ? (
          <>
            <Check className="w-4 h-4" />
            已保存
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            {isSaving ? "保存中…" : "保存设置"}
          </>
        )}
      </button>

      <TwoFactorPinDialog
        open={pinDialogOpen}
        mode={pinDialogMode}
        onOpenChange={setPinDialogOpen}
        onConfirm={handlePinDialogConfirm}
      />
    </div>
  )
}
