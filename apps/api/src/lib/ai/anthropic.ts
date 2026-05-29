import { PROVIDER_ENDPOINTS, type ChatRequest } from "@reviewly/shared"
import { normalizeAnthropicUsage } from "./providers"

export async function callAnthropic(request: ChatRequest) {
  const system = request.messages.find((message) => message.role === "system")?.content
  const messages = request.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }))

  const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": request.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: 1600,
      temperature: request.temperature ?? 0.2,
      ...(system ? { system } : {}),
      messages,
    }),
  })

  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string }
    message?: string
    content?: { text?: string }[]
    usage?: unknown
  } | null

  if (!response.ok) {
    const message = data?.error?.message ?? data?.message ?? `Anthropic 请求失败：${response.status}`
    throw new Error(message)
  }

  const content = Array.isArray(data?.content)
    ? data.content.map((item: { text?: string }) => item.text ?? "").join("\n")
    : ""

  return {
    content,
    usage: normalizeAnthropicUsage(data?.usage),
    raw: data,
  }
}
