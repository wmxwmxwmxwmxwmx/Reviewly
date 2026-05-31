export const PROVIDER_ENDPOINTS = {
  openai: "https://api.openai.com/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  custom: "",
} as const

export type AIProvider = keyof typeof PROVIDER_ENDPOINTS

export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type ChatRequest = {
  provider: AIProvider
  model: string
  apiKey: string
  messages: ChatMessage[]
  temperature?: number
  customEndpoint?: string
}

export type TokenUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type ChatResponse = {
  provider: AIProvider
  model: string
  content: string
  usage: TokenUsage
  latencyMs: number
}

export type ModelValidationErrorType =
  | "invalid_api_key"
  | "model_not_found"
  | "connection_failed"
  | "timeout"
  | "server_error"
  | "invalid_request"

export type ModelValidateRequest = {
  provider: string
  baseUrl?: string
  apiKey: string
  model: string
}

export type ModelValidateResponse = {
  success: boolean
  latency?: number
  model?: string
  provider?: string
  status?: string
  contextWindow?: string | null
  errorType?: ModelValidationErrorType
  message?: string
}

export function isAIProvider(value: unknown): value is AIProvider {
  return typeof value === "string" && value in PROVIDER_ENDPOINTS
}
