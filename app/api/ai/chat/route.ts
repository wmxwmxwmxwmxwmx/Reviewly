import { NextResponse } from "next/server"

const PROVIDER_ENDPOINTS = {
  openai: "https://api.openai.com/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  custom: "",
} as const

type Provider = keyof typeof PROVIDER_ENDPOINTS

type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type ChatRequest = {
  provider: Provider
  model: string
  apiKey: string
  messages: ChatMessage[]
  temperature?: number
  customEndpoint?: string
}

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && value in PROVIDER_ENDPOINTS
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function getEndpoint(provider: Provider, customEndpoint?: string) {
  if (provider === "custom") {
    return customEndpoint?.trim()
  }

  return PROVIDER_ENDPOINTS[provider]
}

function normalizeOpenAIUsage(usage: unknown) {
  const value = usage as Partial<{
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }> | undefined

  const promptTokens = value?.prompt_tokens ?? 0
  const completionTokens = value?.completion_tokens ?? 0
  const totalTokens = value?.total_tokens ?? promptTokens + completionTokens

  return { promptTokens, completionTokens, totalTokens }
}

function normalizeAnthropicUsage(usage: unknown) {
  const value = usage as Partial<{
    input_tokens: number
    output_tokens: number
  }> | undefined

  const promptTokens = value?.input_tokens ?? 0
  const completionTokens = value?.output_tokens ?? 0

  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
}

async function callOpenAICompatible(request: ChatRequest, endpoint: string) {
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

  const data = await response.json().catch(() => null)

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

async function callAnthropic(request: ChatRequest) {
  const system = request.messages.find((message) => message.role === "system")?.content
  const messages = request.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }))

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

  const data = await response.json().catch(() => null)

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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ChatRequest>

    if (!isProvider(body.provider)) {
      return jsonError("请选择有效的模型供应商")
    }

    if (!body.model?.trim()) {
      return jsonError("请填写模型名称")
    }

    if (!body.apiKey?.trim()) {
      return jsonError("请先在系统设置中填写 API Key")
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return jsonError("缺少待发送的消息内容")
    }

    const request: ChatRequest = {
      provider: body.provider,
      model: body.model.trim(),
      apiKey: body.apiKey.trim(),
      messages: body.messages,
      temperature: body.temperature,
      customEndpoint: body.customEndpoint,
    }

    const startedAt = Date.now()
    const result = request.provider === "anthropic"
      ? await callAnthropic(request)
      : await callOpenAICompatible(request, getEndpoint(request.provider, request.customEndpoint) ?? "")

    return NextResponse.json({
      provider: request.provider,
      model: request.model,
      content: result.content,
      usage: result.usage,
      latencyMs: Date.now() - startedAt,
    })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "AI 调用失败", 500)
  }
}
