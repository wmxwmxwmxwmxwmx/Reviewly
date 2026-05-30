/** USD per 1M tokens — aligned with cc-switch preset pricing style. */
export type ModelPricing = {
  inputUsdPerMillion: number
  outputUsdPerMillion: number
}

export type AIProvider =
  | "anthropic"
  | "openai"
  | "google"
  | "deepseek"
  | "openrouter"
  | "custom"

const USD_TO_CNY = 7.2

/** Official-ish list prices (USD / 1M tokens). Unknown models fall back to provider defaults. */
const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4.6": { inputUsdPerMillion: 15, outputUsdPerMillion: 75 },
  "claude-opus-4-20250514": { inputUsdPerMillion: 15, outputUsdPerMillion: 75 },
  "claude-sonnet-4-20250514": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "claude-3-5-sonnet-latest": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "claude-3-5-haiku-latest": { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 },
  "gpt-4o": { inputUsdPerMillion: 2.5, outputUsdPerMillion: 10 },
  "gpt-4o-mini": { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 },
  "gpt-4.1": { inputUsdPerMillion: 2, outputUsdPerMillion: 8 },
  "gpt-4.1-mini": { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
  "gemini-1.5-pro": { inputUsdPerMillion: 1.25, outputUsdPerMillion: 5 },
  "gemini-2.0-flash": { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4 },
  "deepseek-chat": { inputUsdPerMillion: 0.27, outputUsdPerMillion: 1.1 },
  "deepseek-reasoner": { inputUsdPerMillion: 0.55, outputUsdPerMillion: 2.19 },
}

const PROVIDER_FALLBACK: Record<AIProvider, ModelPricing> = {
  anthropic: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  openai: { inputUsdPerMillion: 2.5, outputUsdPerMillion: 10 },
  google: { inputUsdPerMillion: 1.25, outputUsdPerMillion: 5 },
  deepseek: { inputUsdPerMillion: 0.27, outputUsdPerMillion: 1.1 },
  openrouter: { inputUsdPerMillion: 1.5, outputUsdPerMillion: 6 },
  custom: { inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
}

function normalizeModelId(model: string): string {
  return model.trim().toLowerCase()
}

export function resolveModelPricing(provider: AIProvider, model: string): ModelPricing {
  const normalized = normalizeModelId(model)
  if (MODEL_PRICING[normalized]) {
    return MODEL_PRICING[normalized]!
  }
  const partial = Object.entries(MODEL_PRICING).find(([key]) => normalized.includes(key))
  if (partial) {
    return partial[1]
  }
  return PROVIDER_FALLBACK[provider]
}

export function estimateCostUsd(
  provider: AIProvider,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = resolveModelPricing(provider, model)
  return (
    (promptTokens / 1_000_000) * pricing.inputUsdPerMillion +
    (completionTokens / 1_000_000) * pricing.outputUsdPerMillion
  )
}

export function estimateCostCnyFromUsage(
  provider: AIProvider,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  return estimateCostUsd(provider, model, promptTokens, completionTokens) * USD_TO_CNY
}

/** Backward-compatible flat estimate when only total tokens are known. */
export function estimateCostCny(provider: AIProvider, model: string, totalTokens: number): number {
  const half = Math.max(0, totalTokens) / 2
  return estimateCostCnyFromUsage(provider, model, half, half)
}
