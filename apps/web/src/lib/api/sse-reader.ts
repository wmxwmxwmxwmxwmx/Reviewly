import type { ApiError } from "@reviewly/shared"

import { getAuthToken } from "@/lib/auth/storage"

import { extractApiErrorMessage } from "./client"

export type SseReaderOptions = {
  signal?: AbortSignal
  onDelta?: (text: string) => void
  onEvent?: (payload: Record<string, unknown>) => void
  onError?: (message: string) => void
  onDone?: () => void
}

function flushSseBuffer(buffer: string, options: SseReaderOptions): boolean {
  if (!buffer.trim()) return false
  let sawDone = false
  for (const part of buffer.split("\n\n")) {
    for (const line of part.split("\n")) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") {
        sawDone = true
        continue
      }
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>
        if (typeof parsed.error === "string") {
          options.onError?.(parsed.error)
          throw new Error(parsed.error)
        }
        if (typeof parsed.delta === "string") {
          options.onDelta?.(parsed.delta)
        }
        options.onEvent?.(parsed)
      } catch (error) {
        if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
          throw error
        }
      }
    }
  }
  return sawDone
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
    const text = await response.text()
    let msg = response.statusText || "请求失败"
    try {
      const err = JSON.parse(text) as ApiError
      msg = extractApiErrorMessage(err, msg)
    } catch {
      if (/internal server error|socket hang up|ECONNRESET/i.test(text)) {
        msg =
          "后端服务不可用或请求超时。请确认 Gateway 在 localhost:3001 运行，且仅有一个实例。"
      } else if (text.trim()) {
        msg = text.length > 280 ? `${text.slice(0, 280)}…` : text
      }
    }
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
            const parsed = JSON.parse(data) as Record<string, unknown>
            if (typeof parsed.error === "string") {
              options.onError?.(parsed.error)
              throw new Error(parsed.error)
            }
            if (typeof parsed.delta === "string") {
              options.onDelta?.(parsed.delta)
            }
            options.onEvent?.(parsed)
          } catch (error) {
            if (error instanceof Error && !error.message.startsWith("Unexpected")) {
              throw error
            }
          }
        }
      }
    }
    if (flushSseBuffer(buffer, options)) {
      options.onDone?.()
      return
    }
    options.onDone?.()
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return
    }
    const msg = error instanceof Error ? error.message : "流式读取失败"
    options.onError?.(msg)
    throw error instanceof Error ? error : new Error(msg)
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
  const token = getAuthToken()
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })
  await readSseResponse(response, options)
}
