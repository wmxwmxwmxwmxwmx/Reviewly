"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  Bot,
  User,
  Shield,
  Save,
  Check,
  KeyRound,
  Loader2,
  Circle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Link2,
} from "lucide-react"
import type { ModelValidateResponse, SessionTimeoutMinutes } from "@reviewly/shared"

import {
  AI_PROVIDER_OPTIONS,
  defaultBaseUrlForProvider,
  type AIProvider,
  useAISettings,
} from "@/features/prism/contexts/ai-settings-context"
import { useAuth } from "@/features/prism/contexts/auth-context"
import { LocalUninstallDangerZone } from "@/features/prism/components/local-uninstall-danger-zone"
import { ProfileDialog } from "@/features/prism/components/profile-dialog"
import { useSecuritySettings } from "@/features/prism/contexts/security-settings-context"
import { TwoFactorPinDialog } from "@/features/prism/components/two-factor-pin-dialog"
import { SESSION_TIMEOUT_OPTIONS } from "@/features/prism/lib/security-settings"
import { validateModelConfig } from "@/lib/api/models"
import { patchSettings } from "@/lib/api/settings"
import { PrismApiError } from "@/lib/api/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

type ValidationPhase = "idle" | "validating" | "success" | "error"

function formatValidatedAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatValidatedTimeShort(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function providerDisplayLabel(provider: AIProvider) {
  return AI_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider
}

export function SettingsView() {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const { settings, providerLabel, hasApiKey, maskedApiKey, monthlyUsage, clearUsage, updateSettings, settingsHydrated } =
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

  const [aiForm, setAiForm] = useState(settings)
  const [saved, setSaved] = useState(false)
  const [aiSaveError, setAiSaveError] = useState<string | null>(null)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [pinDialogMode, setPinDialogMode] = useState<"setup" | "disable">("setup")
  const [validationPhase, setValidationPhase] = useState<ValidationPhase>("idle")
  const [validationResult, setValidationResult] = useState<ModelValidateResponse | null>(null)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setAiForm(settings)
  }, [settings])

  const configFingerprint = useMemo(
    () =>
      [aiForm.provider, aiForm.model, aiForm.apiKey, aiForm.baseUrl].join("|"),
    [aiForm.apiKey, aiForm.baseUrl, aiForm.model, aiForm.provider],
  )
  const lastValidatedFingerprintRef = useRef<string | null>(null)

  useEffect(() => {
    if (
      lastValidatedFingerprintRef.current &&
      lastValidatedFingerprintRef.current !== configFingerprint &&
      validationPhase !== "validating"
    ) {
      setValidationPhase("idle")
      setValidationResult(null)
      setValidationMessage(null)
    }
  }, [configFingerprint, validationPhase])

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

  const markConfigDirty = () => {
    setSaved(false)
    setValidationPhase("idle")
    setValidationResult(null)
    setValidationMessage(null)
  }

  const handleProviderChange = (provider: AIProvider) => {
    const option = AI_PROVIDER_OPTIONS.find((item) => item.value === provider)
    setAiForm((current) => ({
      ...current,
      provider,
      model: option?.defaultModel ?? current.model,
      baseUrl: defaultBaseUrlForProvider(provider),
    }))
    markConfigDirty()
  }

  const handleTestConnection = async () => {
    if (validationPhase === "validating") return

    setValidationPhase("validating")
    setValidationResult(null)
    setValidationMessage(null)

    try {
      const result = await validateModelConfig({
        provider: aiForm.provider,
        baseUrl: aiForm.baseUrl.trim() || undefined,
        apiKey: aiForm.apiKey,
        model: aiForm.model,
      })

      if (result.success) {
        const validatedAt = new Date().toISOString()
        const nextForm = {
          ...aiForm,
          validatedAt,
          lastValidationStatus: "success" as const,
          lastValidationLatency: result.latency ?? null,
        }
        setAiForm(nextForm)
        setValidationPhase("success")
        setValidationResult(result)
        lastValidatedFingerprintRef.current = configFingerprint
        toast({
          title: zh.settings.validateSuccess,
        })
        return
      }

      setValidationPhase("error")
      setValidationMessage(result.message ?? zh.settings.validateFailed)
      setAiForm((current) => ({
        ...current,
        lastValidationStatus: "failed",
      }))
      toast({
        variant: "destructive",
        title: zh.settings.validateFailed,
        description: result.message,
      })
    } catch (error: unknown) {
      const message = error instanceof PrismApiError ? error.message : zh.settings.validateFailed
      setValidationPhase("error")
      setValidationMessage(message)
      setAiForm((current) => ({
        ...current,
        lastValidationStatus: "failed",
      }))
      toast({
        variant: "destructive",
        title: zh.settings.validateFailed,
        description: message,
      })
    }
  }

  const handleSave = async () => {
    setAiSaveError(null)
    updateSettings(aiForm)
    try {
      await patchSettings({
        ai: {
          provider: aiForm.provider,
          model: aiForm.model,
          temperature: 0.2,
          apiKey: aiForm.apiKey,
          customEndpoint: aiForm.baseUrl.trim() || undefined,
          validatedAt: aiForm.validatedAt ?? null,
          lastValidationStatus: aiForm.lastValidationStatus ?? null,
          lastValidationLatency: aiForm.lastValidationLatency ?? null,
        },
      } as Parameters<typeof patchSettings>[0])
    } catch (e: unknown) {
      setAiSaveError(e instanceof PrismApiError ? e.message : "AI 设置同步到服务端失败")
      return
    }
    const securityOk = await saveSecurity()
    if (securityOk) {
      setSaved(true)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
    }
  }

  const isSaving = securitySaving
  const formDisabled = !settingsHydrated
  const accountUsername = user?.username ?? (authLoading ? "…" : zh.sidebar.notLoggedIn)
  const accountEmail = user?.email ?? (isAuthenticated ? "—" : zh.sidebar.signInHint)

  const showPersistedValidation =
    aiForm.lastValidationStatus === "success" &&
    aiForm.validatedAt &&
    validationPhase !== "validating" &&
    validationPhase !== "success"
  const showValidationHint = !showPersistedValidation && validationPhase !== "success"

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
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {!settingsHydrated && (
            <p className="lg:col-span-2 text-xs text-muted-foreground">正在加载 AI 设置…</p>
          )}
          <label className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">模型供应商</span>
            <select
              value={aiForm.provider}
              disabled={formDisabled}
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
              disabled={formDisabled}
              onChange={(event) => {
                setAiForm((current) => ({ ...current, model: event.target.value }))
                markConfigDirty()
              }}
              placeholder="例如 claude-opus-4.6"
              className="w-full h-10 rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ai-blue focus:ring-2 focus:ring-ai-blue/20"
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{zh.settings.baseUrl}</span>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={aiForm.baseUrl}
                disabled={formDisabled}
                onChange={(event) => {
                  setAiForm((current) => ({ ...current, baseUrl: event.target.value }))
                  markConfigDirty()
                }}
                placeholder={
                  aiForm.provider === "custom"
                    ? "https://your-host/v1/chat/completions"
                    : defaultBaseUrlForProvider(aiForm.provider)
                }
                className="w-full h-10 rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ai-blue focus:ring-2 focus:ring-ai-blue/20"
              />
            </div>
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{zh.settings.apiKey}</span>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={aiForm.apiKey}
                disabled={formDisabled}
                onChange={(event) => {
                  setAiForm((current) => ({ ...current, apiKey: event.target.value }))
                  markConfigDirty()
                }}
                placeholder={`输入供应商 ${zh.settings.apiKey}`}
                className="w-full h-10 rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ai-blue focus:ring-2 focus:ring-ai-blue/20"
              />
            </div>
          </label>
        </div>

        <div className="px-4 pb-4 space-y-3 border-t border-border/60">
          <div className="pt-3 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{zh.settings.modelStatus}</span>
            {validationPhase === "idle" && !showPersistedValidation && (
              <Badge variant="outline" className="text-muted-foreground">
                <Circle className="size-3" />
                {zh.settings.notValidated}
              </Badge>
            )}
            {showPersistedValidation && (
              <Badge className="border-risk-low/30 bg-risk-low/10 text-risk-low hover:bg-risk-low/10">
                <CheckCircle2 className="size-3" />
                {zh.settings.validated}
              </Badge>
            )}
            {validationPhase === "validating" && (
              <Badge variant="outline" className="text-ai-blue border-ai-blue/30">
                <Loader2 className="size-3 animate-spin" />
                {zh.settings.validatingConnection}
              </Badge>
            )}
            {validationPhase === "success" && (
              <Badge className="border-risk-low/30 bg-risk-low/10 text-risk-low hover:bg-risk-low/10">
                <CheckCircle2 className="size-3" />
                {zh.settings.validateSuccess}
              </Badge>
            )}
            {validationPhase === "error" && (
              <Badge variant="destructive">
                <XCircle className="size-3" />
                验证失败
              </Badge>
            )}
          </div>

          {validationPhase === "validating" && (
            <Alert className="border-ai-blue/30 bg-ai-blue/5">
              <Loader2 className="animate-spin text-ai-blue" />
              <AlertTitle>{zh.settings.validatingConnection}</AlertTitle>
              <AlertDescription>正在向模型服务发送最小测试请求…</AlertDescription>
            </Alert>
          )}

          {validationPhase === "success" && validationResult?.success && (
            <div className="rounded-lg border border-border bg-surface-2/50 overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-surface-2/80 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-risk-low" />
                <span className="text-sm font-medium text-foreground">{zh.settings.validateSuccess}</span>
              </div>
              <div className="px-3 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="text-foreground">{validationResult.provider ?? providerDisplayLabel(aiForm.provider)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-mono text-ai-blue">{validationResult.model ?? aiForm.model}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-risk-low">{validationResult.status ?? "Available"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="text-foreground">{validationResult.latency ?? 0}ms</span>
                </div>
                {validationResult.contextWindow && (
                  <div className="flex items-center justify-between gap-3 sm:col-span-2">
                    <span className="text-muted-foreground">Context Window</span>
                    <span className="text-foreground">{validationResult.contextWindow}</span>
                  </div>
                )}
                {aiForm.validatedAt && (
                  <div className="flex items-center justify-between gap-3 sm:col-span-2">
                    <span className="text-muted-foreground">{zh.settings.validatedAt}</span>
                    <span className="text-foreground">{formatValidatedAt(aiForm.validatedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {validationPhase === "error" && validationMessage && (
            <Alert variant="destructive">
              <XCircle />
              <AlertTitle>验证失败</AlertTitle>
              <AlertDescription>{validationMessage}</AlertDescription>
            </Alert>
          )}

          {validationPhase === "idle" && showPersistedValidation && aiForm.validatedAt && (
            <Alert className="border-risk-low/30 bg-risk-low/5">
              <CheckCircle2 className="text-risk-low" />
              <AlertTitle>{zh.settings.validated}</AlertTitle>
              <AlertDescription className="space-y-1">
                <p>
                  模型：<span className="font-mono text-ai-blue">{aiForm.model}</span>
                </p>
                {typeof aiForm.lastValidationLatency === "number" && (
                  <p>
                    {zh.settings.responseTime}：{aiForm.lastValidationLatency}ms
                  </p>
                )}
                <p>
                  {zh.settings.validatedAt}：{formatValidatedAt(aiForm.validatedAt)}
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="px-4 pb-4 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between border-t border-border/60 pt-3">
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
              disabled={formDisabled}
              className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-risk-medium/40 hover:text-risk-medium disabled:opacity-50"
            >
              清空用量
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-lg border border-border overflow-hidden"
      >
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <User className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">账户</span>
        </div>
        <div className="divide-y divide-border">
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">GitHub 用户名</span>
            <span className="text-sm text-foreground font-mono">{accountUsername}</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">邮箱</span>
            <span className="text-sm text-foreground truncate max-w-[60%] text-right">{accountEmail}</span>
          </div>
        </div>
        {isAuthenticated && (
          <div className="px-4 py-2 border-t border-border bg-surface-2">
            <button
              type="button"
              onClick={() => setProfileDialogOpen(true)}
              className="text-xs text-ai-blue hover:underline"
            >
              {zh.accountMenu.viewFullProfile} →
            </button>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-lg border border-border overflow-hidden"
      >
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center gap-2">
          <Shield className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">安全设置</span>
          {security.twoFactorEnabled && (
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full border text-risk-low border-risk-low/30 bg-risk-low/10">
              会话锁定已启用
            </span>
          )}
        </div>
        <div className="divide-y divide-border">
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <span className="text-sm text-foreground">{zh.settings.sessionLock}</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {zh.settings.sessionLockHint}
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

      {aiSaveError && <p className="text-xs text-risk-high">{aiSaveError}</p>}
      {saveError && <p className="text-xs text-risk-high">{saveError}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground min-h-5">
          {showValidationHint && !aiForm.validatedAt && (
            <span className="inline-flex items-center gap-1.5 text-risk-medium">
              <AlertCircle className="size-3.5" />⚠️ {zh.settings.validateSuggest}
            </span>
          )}
          {showPersistedValidation && aiForm.validatedAt && (
            <span className="inline-flex items-center gap-1.5 text-risk-low">
              <CheckCircle2 className="size-3.5" />
              ✅ {zh.settings.validated} · {zh.settings.validatedAt} {formatValidatedTimeShort(aiForm.validatedAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleTestConnection()}
            disabled={formDisabled || validationPhase === "validating" || !aiForm.model.trim()}
          >
            {validationPhase === "validating" ? (
              <>
                <Loader2 className="animate-spin" />
                {zh.settings.testingConnection}
              </>
            ) : (
              zh.settings.testConnection
            )}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || formDisabled}
            className="bg-ai-blue text-white hover:bg-sky-300"
          >
            {saved ? (
              <>
                <Check />
                已保存
              </>
            ) : (
              <>
                <Save />
                {isSaving ? "保存中…" : "保存设置"}
              </>
            )}
          </Button>
        </div>
      </div>

      <LocalUninstallDangerZone />

      <TwoFactorPinDialog
        open={pinDialogOpen}
        mode={pinDialogMode}
        onOpenChange={setPinDialogOpen}
        onConfirm={handlePinDialogConfirm}
      />

      <ProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
    </div>
  )
}
