export const zh = {
  nav: {
    dashboard: "总览面板",
    pullRequests: "合并请求",
    aiReview: "AI 评审",
    security: "安全中心",
    performance: "性能分析",
    architecture: "架构分析",
    governance: "工程治理",
    repos: "仓库管理",
    team: "团队分析",
    settings: "系统设置",
  },
  severity: {
    critical: "严重",
    high: "高危",
    medium: "中危",
    low: "低危",
  },
  riskFile: {
    critical: "严重",
    high: "高危",
    medium: "中危",
    low: "低危",
    none: "正常",
  },
  ai: {
    contextWindow: "上下文窗口",
    breakingChanges: "破坏性变更",
    analyzingChunk: "正在分析分片",
    stream: {
      critical: "严重",
      warning: "警告",
      violation: "违规",
      detectBreakingChanges: "检测 API 破坏性变更...",
    },
    merge: {
      breakingChangeRecord: "破坏性变更记录",
      requiredReviewerApproval: "必需评审人审批",
    },
  },
  provider: {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google Gemini",
    deepseek: "DeepSeek",
    openrouter: "OpenRouter",
    custom: "自定义",
  },
  pr: {
    title: "合并请求",
    allPullRequests: "全部合并请求",
    reviewer: "评审人",
  },
  settings: {
    apiKey: "API 密钥",
  },
} as const

export type RiskSeverityKey = keyof typeof zh.riskFile
