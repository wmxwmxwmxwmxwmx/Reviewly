import type { ModelValidateRequest, ModelValidateResponse } from "@reviewly/shared"

import { apiFetch } from "./client"

export function validateModelConfig(payload: ModelValidateRequest, signal?: AbortSignal) {
  return apiFetch<ModelValidateResponse>("/api/models/validate", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  })
}

export type ProviderBalanceResponse = {
  available: boolean
  amount?: string
  currency?: string
  message?: string
}

export function fetchProviderBalance(
  payload: { provider: string; apiKey?: string; baseUrl?: string },
  signal?: AbortSignal,
) {
  return apiFetch<ProviderBalanceResponse>("/api/models/balance", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  })
}
