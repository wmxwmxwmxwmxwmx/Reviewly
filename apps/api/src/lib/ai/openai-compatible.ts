import type { ChatRequest } from "@reviewly/shared"
import { normalizeOpenAIUsage } from "./providers"

export async function callOpenAICompatible(request: ChatRequest, endpoint: string) {
  if (!endpoint) {
    throw new Error("Custom provider 需要配置 customEndpoint")
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${request.apiKey}`,
      ...(request.provider === "openrouter"
        ? {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "PRism",
          }
        : {}),
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
    }),
  })

  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string }
    message?: string
    choices?: { message?: { content?: string } }[]
    usage?: unknown
  } | null

  if (!response.ok) {
    const message = data?.error?.message ?? data?.message ?? `模型接口请求失败：${response.status}`
    throw new Error(message)
  }

  return {
    content: data?.choices?.[0]?.message?.content ?? "",
    usage: normalizeOpenAIUsage(data?.usage),
    raw: data,
  }
}
