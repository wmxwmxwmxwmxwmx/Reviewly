import type { AiPersistedContent } from "@reviewly/shared"

import { postSse } from "./sse-reader"

export type ChatMessage = { role: string; content: string }

export type ChatRequest = {
  provider: string
  model: string
  apiKey?: string
  customEndpoint?: string
  messages: ChatMessage[]
  temperature?: number
  stream?: boolean
}

export type ChatResponse = {
  provider: string
  model: string
  content: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  latencyMs?: number
}

function buildChatBody(request: ChatRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    provider: request.provider,
    model: request.model,
    messages: request.messages,
    stream: request.stream ?? false,
  }
  if (request.apiKey?.trim()) {
    body.apiKey = request.apiKey.trim()
  }
  if (request.customEndpoint?.trim()) {
    body.customEndpoint = request.customEndpoint.trim()
  }
  if (request.temperature !== undefined) {
    body.temperature = request.temperature
  }
  return body
}

export function parseChatResponse(data: unknown): ChatResponse {
  if (!data || typeof data !== "object") {
    throw new Error("AI 响应格式无效")
  }
  const record = data as Record<string, unknown>
  const content = record.content
  if (typeof content !== "string") {
    throw new Error("AI 响应缺少 content")
  }
  return {
    provider: String(record.provider ?? ""),
    model: String(record.model ?? ""),
    content,
    usage:
      record.usage && typeof record.usage === "object"
        ? (record.usage as ChatResponse["usage"])
        : undefined,
    latencyMs: typeof record.latencyMs === "number" ? record.latencyMs : undefined,
  }
}

export async function chatCompletion(
  request: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildChatBody({ ...request, stream: false })),
    signal,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const errMsg =
      data && typeof data === "object"
        ? String(
            (data as { error?: string; detail?: { error?: string } }).error ??
              (data as { detail?: { error?: string } }).detail?.error ??
              "AI 请求失败",
          )
        : "AI 请求失败"
    throw new Error(errMsg)
  }

  return parseChatResponse(data)
}

export async function chatCompletionStream(
  request: ChatRequest,
  options: {
    signal?: AbortSignal
    onDelta: (text: string) => void
    onError?: (message: string) => void
    onDone?: () => void
  },
): Promise<void> {
  await postSse(
    "/api/ai/chat",
    buildChatBody({ ...request, stream: true }),
    options,
  )
}

export function patchPrAiSummary(
  prId: string,
  body: AiPersistedContent,
  signal?: AbortSignal,
): Promise<AiPersistedContent> {
  return fetch(`/api/pull-requests/${prId}/ai-summary`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  }).then(async (res) => {
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const msg =
        data && typeof data === "object"
          ? String(
              (data as { error?: string; detail?: { error?: string } }).error ??
                (data as { detail?: { error?: string } }).detail?.error ??
                "保存 AI 摘要失败",
            )
          : "保存 AI 摘要失败"
      throw new Error(msg)
    }
    return data as AiPersistedContent
  })
}

export async function fetchPrAiSummary(
  prId: string,
  signal?: AbortSignal,
): Promise<AiPersistedContent | null> {
  const res = await fetch(`/api/pull-requests/${prId}/ai-summary`, { signal })
  if (res.status === 404) return null
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(
      data && typeof data === "object"
        ? String(
            (data as { error?: string; detail?: { error?: string } }).error ??
              (data as { detail?: { error?: string } }).detail?.error ??
              "加载 AI 摘要失败",
          )
        : "加载 AI 摘要失败",
    )
  }
  return (await res.json()) as AiPersistedContent
}
