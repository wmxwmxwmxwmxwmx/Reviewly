export type AnalysisPanelState = "empty" | "running" | "completed"

export function resolveAnalysisPanelState(input: {
  analysisComplete: boolean
  analysisJobRunning: boolean
}): AnalysisPanelState {
  if (!input.analysisComplete) {
    return input.analysisJobRunning ? "running" : "empty"
  }
  return "completed"
}

export function resolveRunningLabel(input: {
  scanning: boolean
  summaryStreaming: boolean
}): string {
  if (input.summaryStreaming) return "AI 总结生成中..."
  if (input.scanning) return "规则扫描中..."
  return "正在分析..."
}
