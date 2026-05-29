import { PROVIDER_ENDPOINTS, type AIProvider } from "@reviewly/shared"

export { PROVIDER_ENDPOINTS, type AIProvider }

export function getEndpoint(provider: AIProvider, customEndpoint?: string) {
  if (provider === "custom") {
    return customEndpoint?.trim()
  }

  return PROVIDER_ENDPOINTS[provider]
}

export function normalizeOpenAIUsage(usage: unknown) {
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

export function normalizeAnthropicUsage(usage: unknown) {
  const value = usage as Partial<{
    input_tokens: number
    output_tokens: number
  }> | undefined

  const promptTokens = value?.input_tokens ?? 0
  const completionTokens = value?.output_tokens ?? 0

  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
}
