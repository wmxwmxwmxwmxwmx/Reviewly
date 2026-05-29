import { NextResponse } from "next/server"
import { isAIProvider, type ChatRequest } from "@reviewly/shared"
import { callAnthropic, callOpenAICompatible, getEndpoint } from "@/lib/ai"

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ChatRequest>

    if (!isAIProvider(body.provider)) {
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
    const result =
      request.provider === "anthropic"
        ? await callAnthropic(request)
        : await callOpenAICompatible(
            request,
            getEndpoint(request.provider, request.customEndpoint) ?? "",
          )

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
