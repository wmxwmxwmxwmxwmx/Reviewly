const STORE_KEY = "prism:review-task-store"
const LEGACY_DISMISS_KEY = "prism:inbox-dismissed"
export const RESCORE_EVENT = "prism:rescore"

export type ReviewTaskStoreSnapshot = {
  deferred: string[]
  returnedToInbox: string[]
  dismissed: string[]
  ignoredPatterns: string[]
}

const DEFAULT_STORE: ReviewTaskStoreSnapshot = {
  deferred: [],
  returnedToInbox: [],
  dismissed: [],
  ignoredPatterns: ["docs:", "doc:", "readme", "typo", "format", "chore(deps)"],
}

function uniq(ids: string[]): string[] {
  return [...new Set(ids)]
}

function migrateLegacyDismissed(store: ReviewTaskStoreSnapshot): ReviewTaskStoreSnapshot {
  if (typeof sessionStorage === "undefined") return store
  try {
    const raw = sessionStorage.getItem(LEGACY_DISMISS_KEY)
    if (!raw) return store
    const legacy = JSON.parse(raw) as string[]
    sessionStorage.removeItem(LEGACY_DISMISS_KEY)
    return {
      ...store,
      dismissed: uniq([...store.dismissed, ...legacy]),
    }
  } catch {
    return store
  }
}

export function readStore(): ReviewTaskStoreSnapshot {
  if (typeof window === "undefined") return { ...DEFAULT_STORE }
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (!raw) {
      const migrated = migrateLegacyDismissed({ ...DEFAULT_STORE })
      writeStore(migrated)
      return migrated
    }
    const parsed = JSON.parse(raw) as Partial<ReviewTaskStoreSnapshot>
    const store: ReviewTaskStoreSnapshot = {
      deferred: parsed.deferred ?? [],
      returnedToInbox: parsed.returnedToInbox ?? [],
      dismissed: parsed.dismissed ?? [],
      ignoredPatterns: parsed.ignoredPatterns ?? DEFAULT_STORE.ignoredPatterns,
    }
    return migrateLegacyDismissed(store)
  } catch {
    return { ...DEFAULT_STORE }
  }
}

export function writeStore(store: ReviewTaskStoreSnapshot): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

export function deferPr(prId: string): ReviewTaskStoreSnapshot {
  const store = readStore()
  const next = {
    ...store,
    deferred: uniq([...store.deferred, prId]),
  }
  writeStore(next)
  return next
}

export function returnToInbox(prId: string): ReviewTaskStoreSnapshot {
  const store = readStore()
  const next = {
    ...store,
    returnedToInbox: uniq([...store.returnedToInbox, prId]),
    deferred: store.deferred.filter((id) => id !== prId),
  }
  writeStore(next)
  return next
}

export function dismissPr(prId: string): ReviewTaskStoreSnapshot {
  const store = readStore()
  const next = {
    ...store,
    dismissed: uniq([...store.dismissed, prId]),
  }
  writeStore(next)
  return next
}

export function clearPrOverrides(prId: string): ReviewTaskStoreSnapshot {
  const store = readStore()
  const next = {
    ...store,
    deferred: store.deferred.filter((id) => id !== prId),
    dismissed: store.dismissed.filter((id) => id !== prId),
    returnedToInbox: store.returnedToInbox.filter((id) => id !== prId),
  }
  writeStore(next)
  return next
}

export function clearDeferred(): ReviewTaskStoreSnapshot {
  const store = readStore()
  const next = { ...store, deferred: [] }
  writeStore(next)
  return next
}

export function restoreAllDone(donePrIds: string[]): ReviewTaskStoreSnapshot {
  const store = readStore()
  const next = {
    ...store,
    returnedToInbox: uniq([...store.returnedToInbox, ...donePrIds]),
  }
  writeStore(next)
  return next
}

export function setIgnoredPatterns(patterns: string[]): ReviewTaskStoreSnapshot {
  const store = readStore()
  const next = { ...store, ignoredPatterns: patterns }
  writeStore(next)
  return next
}

export function dispatchRescore(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(RESCORE_EVENT))
}

export function isDismissed(store: ReviewTaskStoreSnapshot, prId: string): boolean {
  return store.dismissed.includes(prId)
}

export function isDeferred(store: ReviewTaskStoreSnapshot, prId: string): boolean {
  return store.deferred.includes(prId)
}

export function isReturnedToInbox(store: ReviewTaskStoreSnapshot, prId: string): boolean {
  return store.returnedToInbox.includes(prId)
}
