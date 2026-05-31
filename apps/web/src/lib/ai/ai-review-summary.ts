import type { AiUsageMetrics, AnalysisFinding, GovernanceRule, PullRequest } from "@reviewly/shared"

import type { AIProvider } from "@/features/prism/contexts/ai-settings-context"

import {
  AI_REVIEW_MAX_OUTPUT_TOKENS,
  AI_REVIEW_MAX_VALIDATION_ATTEMPTS,
  AI_REVIEW_PROMPT_VERSION,
  AI_REVIEW_TEMPERATURE,
  buildAiReviewRepairUserMessage,
  sortGovernanceRulesForPrompt,
  validateAiReviewReport,
} from "@/lib/ai/ai-review-consistency"
import {
  buildAiReviewSystemPrompt,
  buildAiReviewUserPrompt,
} from "@/lib/ai/ai-review-prompt"
import { buildGovernancePromptContext } from "@/lib/ai/governance-prompt-context"
import { buildFindingsContext } from "@/lib/ai/prompt-budget"
import { chatCompletionStream, type ChatMessage } from "@/lib/api/ai-chat"
import { estimateCostCnyFromUsage } from "@/lib/ai/pricing"

export type GenerateAiReviewSummaryInput = {
  pr: PullRequest
  findings: AnalysisFinding[]
  governanceRules: GovernanceRule[]
  diffContext: string
  diffTruncated: boolean
  jobSummary?: string
  analysisVersion?: string | null
  provider: AIProvider
  model: string
  apiKey: string
  baseUrl?: string
  signal: AbortSignal
  onDelta: (text: string) => void
}

export type GenerateAiReviewSummaryResult = {
  content: string
  usage: AiUsageMetrics
  validationWarnings: string[]
}

async function streamReviewMessages(
  messages: ChatMessage[],
  input: GenerateAiReviewSummaryInput,
  onAccumulated: (text: string) => void,
): Promise<{ text: string; usage: AiUsageMetrics }> {
  let accumulated = ""
  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0
  let latencyMs = 0

  await chatCompletionStream(
    {
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey.trim() || undefined,
      customEndpoint: input.baseUrl?.trim() || undefined,
      temperature: AI_REVIEW_TEMPERATURE,
      maxTokens: AI_REVIEW_MAX_OUTPUT_TOKENS,
      messages,
    },
    {
      signal: input.signal,
      onDelta: (delta) => {
        accumulated += delta
        onAccumulated(accumulated)
        input.onDelta(accumulated)
      },
      onUsage: (meta) => {
        if (meta.usage) {
          promptTokens = meta.usage.promptTokens
          completionTokens = meta.usage.completionTokens
          totalTokens = meta.usage.totalTokens
        }
        if (typeof meta.latencyMs === "number") {
          latencyMs = meta.latencyMs
        }
      },
      onError: (msg) => {
        throw new Error(msg)
      },
    },
  )

  const resolvedTotal = totalTokens || promptTokens + completionTokens
  const usage: AiUsageMetrics = {
    promptTokens,
    completionTokens,
    totalTokens: resolvedTotal,
    costCny: estimateCostCnyFromUsage(
      input.provider,
      input.model,
      promptTokens,
      completionTokens,
    ),
    latencyMs,
  }

  return { text: accumulated.trim(), usage }
}

export async function generateAiReviewSummary(
  input: GenerateAiReviewSummaryInput,
): Promise<GenerateAiReviewSummaryResult> {
  const governanceText = buildGovernancePromptContext(
    sortGovernanceRulesForPrompt(input.governanceRules),
  )
  const findingsContext = buildFindingsContext(input.findings)

  const baseUserContent = buildAiReviewUserPrompt({
    title: input.pr.title,
    repo: input.pr.repo,
    sourceBranch: input.pr.sourceBranch,
    targetBranch: input.pr.targetBranch,
    filesChanged: input.pr.filesChanged,
    additions: input.pr.additions,
    deletions: input.pr.deletions,
    diffTruncated: input.diffTruncated,
    governanceText,
    findingsContext,
    diffContext: input.diffContext,
  })

  const systemMessage: ChatMessage = {
    role: "system",
    content: buildAiReviewSystemPrompt(),
  }
  const userMessage: ChatMessage = {
    role: "user",
    content: baseUserContent,
  }

  let messages: ChatMessage[] = [systemMessage, userMessage]
  let lastText = ""
  let lastUsage: AiUsageMetrics = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costCny: 0,
  }
  const validationWarnings: string[] = []

  for (let attempt = 1; attempt <= AI_REVIEW_MAX_VALIDATION_ATTEMPTS; attempt += 1) {
    if (input.signal.aborted) {
      break
    }

    const streamed = await streamReviewMessages(messages, input, (text) => {
      lastText = text
    })
    lastText = streamed.text
    lastUsage = streamed.usage

    const validation = validateAiReviewReport(lastText)
    if (validation.valid) {
      return {
        content: lastText,
        usage: lastUsage,
        validationWarnings,
      }
    }

    validationWarnings.push(...validation.issues)

    if (attempt >= AI_REVIEW_MAX_VALIDATION_ATTEMPTS) {
      break
    }

    messages = [
      systemMessage,
      userMessage,
      { role: "assistant", content: lastText },
      { role: "user", content: buildAiReviewRepairUserMessage(validation.issues) },
    ]
  }

  const fallback = lastText || input.jobSummary?.trim() || "模型未返回内容。"
  return {
    content: fallback,
    usage: lastUsage,
    validationWarnings,
  }
}

export function buildAiSummaryPersistPayload(input: {
  content: string
  model: string
  provider: string
  usage?: AiUsageMetrics
  analysisVersion?: string | null
}): {
  content: string
  analyzedAt: string
  model: string
  provider: string
  analysisVersion?: string
  promptVersion: string
  usage?: AiUsageMetrics
} {
  return {
    content: input.content,
    analyzedAt: new Date().toISOString(),
    model: input.model,
    provider: input.provider,
    promptVersion: AI_REVIEW_PROMPT_VERSION,
    ...(input.analysisVersion ? { analysisVersion: input.analysisVersion } : {}),
    ...(input.usage ? { usage: input.usage } : {}),
  }
}
