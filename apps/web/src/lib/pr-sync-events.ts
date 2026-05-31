export const PR_SYNC_UPDATED_EVENT = "pr:sync:updated"

export type PrSyncUpdatedDetail = {
  at: string
  stats?: {
    synced?: number
    created?: number
    updated?: number
    closed?: number
    repos?: number
  }
}

export function dispatchPrSyncUpdated(detail: PrSyncUpdatedDetail): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(PR_SYNC_UPDATED_EVENT, { detail }))
}
