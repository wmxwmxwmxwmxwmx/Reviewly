import type { PrismSettings } from "@reviewly/shared"

import { apiFetch } from "./client"

export function fetchSettings(signal?: AbortSignal) {
  return apiFetch<PrismSettings>("/api/settings", { signal })
}

export function patchSettings(patch: Partial<PrismSettings>) {
  return apiFetch<PrismSettings>("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}
