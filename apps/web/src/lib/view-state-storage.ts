const PREFIX = "prism:view:"

export function readViewState<T extends Record<string, unknown>>(viewKey: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${viewKey}`)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeViewState<T extends Record<string, unknown>>(viewKey: string, state: T): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(`${PREFIX}${viewKey}`, JSON.stringify(state))
  } catch {
    /* quota or private mode */
  }
}
