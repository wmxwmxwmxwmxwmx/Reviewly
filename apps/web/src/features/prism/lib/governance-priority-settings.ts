import type { ReviewTaskRisk } from "@/features/prism/types/review-task"

const SETTINGS_KEY = "prism:governance-priority-settings"

export type PrioritySettings = {
  riskWeights: Record<ReviewTaskRisk, number>
  ciFailed: number
  authPayment: number
  testsMissing: number
  complexityFactor: number
  filesFactor: number
  docsOnlyPenalty: number
  smallChangePenalty: number
  deferredMultiplier: number
}

export const DEFAULT_PRIORITY_SETTINGS: PrioritySettings = {
  riskWeights: {
    严重: 80,
    高: 60,
    中: 35,
    低: 10,
  },
  ciFailed: 30,
  authPayment: 25,
  testsMissing: 20,
  complexityFactor: 0.3,
  filesFactor: 0.2,
  docsOnlyPenalty: 30,
  smallChangePenalty: 20,
  deferredMultiplier: 0.8,
}

export function readPrioritySettings(): PrioritySettings {
  if (typeof window === "undefined") return { ...DEFAULT_PRIORITY_SETTINGS }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_PRIORITY_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<PrioritySettings>
    return {
      ...DEFAULT_PRIORITY_SETTINGS,
      ...parsed,
      riskWeights: {
        ...DEFAULT_PRIORITY_SETTINGS.riskWeights,
        ...parsed.riskWeights,
      },
    }
  } catch {
    return { ...DEFAULT_PRIORITY_SETTINGS }
  }
}

export function writePrioritySettings(settings: PrioritySettings): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
