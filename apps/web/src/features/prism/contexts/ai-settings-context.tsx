"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { fetchSettings } from "@/lib/api/settings"
import { zh } from "@/lib/i18n/zh"

export type AIProvider = "anthropic" | "openai" | "google" | "deepseek" | "openrouter" | "custom"

export interface AIProviderOption {
  value: AIProvider
  label: string
  defaultModel: string
}

export interface AISettings {
  provider: AIProvider
  model: string
  apiKey: string
}

export interface AIUsageRecord {
  id: string
  provider: AIProvider
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costCny: number
  latencyMs: number
  createdAt: string
}

interface MonthlyUsage {
  totalTokens: number
  costCny: number
  calls: number
}

interface AISettingsContextValue {
  settings: AISettings
  settingsHydrated: boolean
  providerLabel: string
  hasApiKey: boolean
  maskedApiKey: string
  usageRecords: AIUsageRecord[]
  monthlyUsage: MonthlyUsage
  updateSettings: (nextSettings: AISettings) => void
  updateSetting: <K extends keyof AISettings>(key: K, value: AISettings[K]) => void
  recordUsage: (record: Omit<AIUsageRecord, "id" | "createdAt"> & { createdAt?: string }) => void
  clearUsage: () => void
}

const SETTINGS_STORAGE_KEY = "prism.ai-settings"
const USAGE_STORAGE_KEY = "prism.ai-usage-records"

export const AI_PROVIDER_OPTIONS: AIProviderOption[] = [
  { value: "anthropic", label: zh.provider.anthropic, defaultModel: "claude-opus-4.6" },
  { value: "openai", label: zh.provider.openai, defaultModel: "gpt-4o-mini" },
  { value: "google", label: zh.provider.google, defaultModel: "gemini-1.5-pro" },
  { value: "deepseek", label: zh.provider.deepseek, defaultModel: "deepseek-chat" },
  { value: "openrouter", label: zh.provider.openrouter, defaultModel: "openrouter/auto" },
  { value: "custom", label: zh.provider.custom, defaultModel: "custom-model" },
]

const DEFAULT_SETTINGS: AISettings = {
  provider: "anthropic",
  model: "claude-opus-4.6",
  apiKey: "",
}

const AISettingsContext = createContext<AISettingsContextValue | null>(null)

function isProvider(value: unknown): value is AIProvider {
  return typeof value === "string" && AI_PROVIDER_OPTIONS.some((option) => option.value === value)
}

function normalizeSettings(value: unknown): AISettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS
  }

  const candidate = value as Partial<AISettings>
  const provider = isProvider(candidate.provider) ? candidate.provider : DEFAULT_SETTINGS.provider
  const fallbackModel = AI_PROVIDER_OPTIONS.find((option) => option.value === provider)?.defaultModel ?? DEFAULT_SETTINGS.model

  return {
    provider,
    model: typeof candidate.model === "string" && candidate.model.trim() ? candidate.model : fallbackModel,
    apiKey: typeof candidate.apiKey === "string" ? candidate.apiKey : "",
  }
}

function normalizeUsageRecords(value: unknown): AIUsageRecord[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((record) => {
    if (!record || typeof record !== "object") {
      return []
    }

    const candidate = record as Partial<AIUsageRecord>

    if (!isProvider(candidate.provider) || typeof candidate.model !== "string") {
      return []
    }

    return [{
      id: typeof candidate.id === "string" ? candidate.id : crypto.randomUUID(),
      provider: candidate.provider,
      model: candidate.model,
      promptTokens: Number(candidate.promptTokens) || 0,
      completionTokens: Number(candidate.completionTokens) || 0,
      totalTokens: Number(candidate.totalTokens) || 0,
      costCny: Number(candidate.costCny) || 0,
      latencyMs: Number(candidate.latencyMs) || 0,
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    }]
  })
}

function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim()

  if (!trimmed) {
    return "未配置"
  }

  if (trimmed.length <= 8) {
    return "••••••••"
  }

  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-4)}`
}

function isCurrentMonth(isoDate: string) {
  const date = new Date(isoDate)
  const now = new Date()

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export function estimateCostCny(provider: AIProvider, totalTokens: number) {
  const pricePerMillionTokens: Record<AIProvider, number> = {
    anthropic: 42,
    openai: 8,
    google: 7,
    deepseek: 2,
    openrouter: 10,
    custom: 0,
  }

  return (totalTokens / 1_000_000) * pricePerMillionTokens[provider]
}

type ServerSettingsPayload = {
  ai?: { provider?: string; model?: string; temperature?: number }
  secrets?: Record<string, string>
}

export function AISettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS)
  const [usageRecords, setUsageRecords] = useState<AIUsageRecord[]>([])
  const [settingsHydrated, setSettingsHydrated] = useState(false)
  const [serverSecretConfigured, setServerSecretConfigured] = useState(false)

  useEffect(() => {
    try {
      const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
      const rawUsage = window.localStorage.getItem(USAGE_STORAGE_KEY)

      if (rawSettings) {
        setSettings(normalizeSettings(JSON.parse(rawSettings)))
      }

      if (rawUsage) {
        setUsageRecords(normalizeUsageRecords(JSON.parse(rawUsage)))
      }
    } catch {
      setSettings(DEFAULT_SETTINGS)
      setUsageRecords([])
    } finally {
      setSettingsHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!settingsHydrated) return

    let cancelled = false

    void fetchSettings()
      .then((data) => {
        if (cancelled) return
        const payload = data as ServerSettingsPayload & typeof data
        let resolvedProvider: AIProvider = DEFAULT_SETTINGS.provider
        setSettings((current) => {
          const provider = isProvider(payload.ai?.provider)
            ? payload.ai.provider
            : current.provider
          resolvedProvider = provider
          const fallbackModel =
            AI_PROVIDER_OPTIONS.find((option) => option.value === provider)?.defaultModel ??
            DEFAULT_SETTINGS.model
          return normalizeSettings({
            ...current,
            provider,
            model:
              typeof payload.ai?.model === "string" && payload.ai.model.trim()
                ? payload.ai.model
                : current.model || fallbackModel,
          })
        })
        const secrets = payload.secrets ?? {}
        const hasServer =
          Boolean(secrets[resolvedProvider]) ||
          Boolean(secrets.apiKey) ||
          Object.values(secrets).some((value) => typeof value === "string" && value.length > 0)
        setServerSecretConfigured(hasServer)
      })
      .catch(() => {
        if (!cancelled) {
          setServerSecretConfigured(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [settingsHydrated])

  useEffect(() => {
    if (!settingsHydrated) return
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings, settingsHydrated])

  useEffect(() => {
    if (!settingsHydrated) return
    window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usageRecords))
  }, [usageRecords, settingsHydrated])

  const updateSettings = useCallback((nextSettings: AISettings) => {
    setSettings(normalizeSettings(nextSettings))
  }, [])

  const updateSetting = useCallback(<K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setSettings((current) => normalizeSettings({ ...current, [key]: value }))
  }, [])

  const recordUsage = useCallback((record: Omit<AIUsageRecord, "id" | "createdAt"> & { createdAt?: string }) => {
    setUsageRecords((current) => [
      {
        ...record,
        id: crypto.randomUUID(),
        createdAt: record.createdAt ?? new Date().toISOString(),
      },
      ...current,
    ].slice(0, 200))
  }, [])

  const clearUsage = useCallback(() => {
    setUsageRecords([])
  }, [])

  const value = useMemo<AISettingsContextValue>(() => {
    const resolvedSettings = settingsHydrated ? settings : DEFAULT_SETTINGS
    const resolvedUsageRecords = settingsHydrated ? usageRecords : []
    const providerLabel =
      AI_PROVIDER_OPTIONS.find((option) => option.value === resolvedSettings.provider)?.label ??
      zh.provider.custom
    const monthlyRecords = resolvedUsageRecords.filter((record) => isCurrentMonth(record.createdAt))

    return {
      settings: resolvedSettings,
      settingsHydrated,
      providerLabel,
      hasApiKey:
        settingsHydrated &&
        (settings.apiKey.trim().length > 0 || serverSecretConfigured),
      maskedApiKey: maskApiKey(settingsHydrated ? settings.apiKey : ""),
      usageRecords: resolvedUsageRecords,
      monthlyUsage: {
        totalTokens: monthlyRecords.reduce((sum, record) => sum + record.totalTokens, 0),
        costCny: monthlyRecords.reduce((sum, record) => sum + record.costCny, 0),
        calls: monthlyRecords.length,
      },
      updateSettings,
      updateSetting,
      recordUsage,
      clearUsage,
    }
  }, [
    settings,
    settingsHydrated,
    serverSecretConfigured,
    usageRecords,
    updateSettings,
    updateSetting,
    recordUsage,
    clearUsage,
  ])

  return <AISettingsContext.Provider value={value}>{children}</AISettingsContext.Provider>
}

export function useAISettings() {
  const context = useContext(AISettingsContext)

  if (!context) {
    throw new Error("useAISettings must be used within AISettingsProvider")
  }

  return context
}
