export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true
  }
  if (error instanceof Error && error.name === "AbortError") {
    return true
  }
  return false
}

/** Only apply async result updates when the request was not superseded or aborted. */
export function shouldApplyResult(signal?: AbortSignal): boolean {
  return !signal?.aborted
}
