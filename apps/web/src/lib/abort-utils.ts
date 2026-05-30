export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

/** Only apply async result updates when the request was not superseded or aborted. */
export function shouldApplyResult(signal?: AbortSignal): boolean {
  return !signal?.aborted
}
