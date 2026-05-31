/** Global mutex: one PR sync write path at a time (Provider + fallback). */

export type ManagedPrSyncStats = {
  ok?: boolean
  skipped?: boolean
  synced?: number
  created?: number
  updated?: number
  closed?: number
  softMarked?: number
  repos?: number
}

let inFlight: Promise<ManagedPrSyncStats | void> | null = null

export function isPrSyncInFlight(): boolean {
  return inFlight !== null
}

/**
 * Coalesce concurrent sync requests into a single in-flight operation.
 * Returns undefined when joining an existing run (caller should refresh lists only).
 */
export async function withPrSyncMutex<T extends ManagedPrSyncStats | void>(
  fn: () => Promise<T>,
): Promise<T | undefined> {
  if (inFlight) {
    await inFlight.catch(() => undefined)
    return undefined
  }

  const run = fn().finally(() => {
    if (inFlight === run) {
      inFlight = null
    }
  })
  inFlight = run as Promise<ManagedPrSyncStats | void>
  return run
}
