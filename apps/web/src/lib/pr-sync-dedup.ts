/** Interval-only dedup + last stats cache for managed PR sync. */

import type { ManagedPrSyncStats } from "@/lib/pr-sync-mutex"

const INTERVAL_DEDUP_MS = 60_000

let lastIntervalSyncAt = 0
let lastStats: ManagedPrSyncStats | null = null

export function getLastManagedSyncStats(): ManagedPrSyncStats | null {
  return lastStats
}

export function shouldSkipIntervalManagedSync(now = Date.now()): boolean {
  return lastIntervalSyncAt > 0 && now - lastIntervalSyncAt < INTERVAL_DEDUP_MS
}

export function recordIntervalManagedSync(stats: ManagedPrSyncStats): void {
  lastIntervalSyncAt = Date.now()
  lastStats = stats
}

export function recordManagedSyncStats(stats: ManagedPrSyncStats): void {
  lastStats = stats
}

export function skippedIntervalStats(): ManagedPrSyncStats {
  return { ...(lastStats ?? {}), skipped: true, ok: true }
}
