import type { AiPersistedContent } from "@reviewly/shared"

import { apiFetch, PrismApiError } from "./client"
import { postSse } from "./sse-reader"

export type ChatMessage = { role: string; content: string }

export type ChatRequest = {
  provider: string
  model: string
  apiKey?: string
  customEndpoint?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export type ChatUsageMetrics = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type ChatStreamMeta = {
  usage?: ChatUsageMetrics
  latencyMs?: number
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

function parseStreamUsage(payload: Record<string, unknown>): ChatStreamMeta | null {
  const usageRaw = payload.usage
  if (!usageRaw || typeof usageRaw !== "object") {
    if (typeof payload.latencyMs === "number") {
      return { latencyMs: payload.latencyMs }
    }
    return null
  }
  const usage = usageRaw as Record<string, unknown>
  const promptTokens = Number(usage.promptTokens) || 0
  const completionTokens = Number(usage.completionTokens) || 0
  const totalTokens = Number(usage.totalTokens) || promptTokens + completionTokens
  return {
    usage: { promptTokens, completionTokens, totalTokens },
    latencyMs: typeof payload.latencyMs === "number" ? payload.latencyMs : undefined,
  }
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
  if (request.maxTokens !== undefined) {
    body.maxTokens = request.maxTokens
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

/** Non-streaming chat via the unified JSON client. */
export async function completeChat(
  request: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const data = await apiFetch<unknown>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(buildChatBody({ ...request, stream: false })),
    signal,
    noRetry: true,
  })
  return parseChatResponse(data)
}

export async function chatCompletionStream(
  request: ChatRequest,
  options: {
    signal?: AbortSignal
    onDelta: (text: string) => void
    onUsage?: (meta: ChatStreamMeta) => void
    onError?: (message: string) => void
    onDone?: () => void
  },
): Promise<void> {
  await postSse("/api/ai/chat", buildChatBody({ ...request, stream: true }), {
    ...options,
    onEvent: (payload) => {
      const meta = parseStreamUsage(payload)
      if (meta) {
        options.onUsage?.(meta)
      }
    },
  })
}

export function patchPrAiSummary(
  prId: string,
  body: AiPersistedContent,
  signal?: AbortSignal,
): Promise<AiPersistedContent> {
  return apiFetch<AiPersistedContent>(`/api/pull-requests/${prId}/ai-summary`, {
    method: "PATCH",
    body: JSON.stringify(body),
    signal,
    noRetry: true,
  })
}

export async function fetchPrAiSummary(
  prId: string,
  signal?: AbortSignal,
): Promise<AiPersistedContent | null> {
  try {
    return await apiFetch<AiPersistedContent>(`/api/pull-requests/${prId}/ai-summary`, {
      signal,
      noRetry: true,
    })
  } catch (err) {
    if (err instanceof PrismApiError && err.status === 404) {
      return null
    }
    throw err
  }
}
