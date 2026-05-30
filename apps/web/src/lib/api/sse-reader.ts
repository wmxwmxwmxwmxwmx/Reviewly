export type SseReaderOptions = {
  signal?: AbortSignal
  onDelta: (text: string) => void
  onError?: (message: string) => void
  onDone?: () => void
}

/**
 * Read a fetch Response body as SSE events (`data: {"delta"}` / `{"error"}` / `[DONE]`).
 * Always cancels the reader in finally.
 */
export async function readSseResponse(
  response: Response,
  options: SseReaderOptions,
): Promise<void> {
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg =
      typeof err === "object" && err && "detail" in err
        ? String((err as { detail?: { error?: string } }).detail?.error ?? response.statusText)
        : response.statusText
    options.onError?.(msg)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    options.onError?.("无法读取响应流")
    return
  }

  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""

      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") {
            options.onDone?.()
            return
          }
          try {
            const parsed = JSON.parse(data) as { delta?: string; error?: string }
            if (parsed.error) {
              options.onError?.(parsed.error)
              return
            }
            if (parsed.delta) options.onDelta(parsed.delta)
          } catch {
            /* ignore malformed chunks */
          }
        }
      }
    }
    options.onDone?.()
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return
    }
    options.onError?.(error instanceof Error ? error.message : "流式读取失败")
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* reader may already be closed */
    }
  }
}

export async function postSse(
  url: string,
  body: unknown,
  options: SseReaderOptions,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  })
  await readSseResponse(response, options)
}
