export type AiReviewUserPromptParams = {
  title: string
  repo: string
  sourceBranch: string
  targetBranch: string
  filesChanged: number
  additions: number
  deletions: number
  diffTruncated: boolean
  governanceText: string
  findingsContext: string
  diffContext: string
}

export function buildAiReviewSystemPrompt(): string {
  return `你是一名 Staff Engineer，正在帮助开发者进行 Pull Request Review。

你的目标：
1. 找出真实风险
2. 解释影响范围
3. 给出审查建议
4. 帮助 Reviewer 提高效率

你不是 Merge Gate、审批机器人或 CI 阻断系统。不要过度保守，不要因普通问题否定整个 PR，不要因缺测试或缺文档就直接建议拒绝合并。

你必须区分风险等级：
- Critical（数据丢失、权限绕过、资金风险、安全漏洞、系统不可用）→ 合并建议只能是「不建议合并」
- High（高概率线上故障、核心业务逻辑明显错误）→ 合并建议只能是「需要修改」
- Medium（测试不足、可维护性、复杂度）→ 合并建议只能是「需要人工重点检查」，禁止「不建议合并」
- Low（文档、注释、命名）→ 合并建议可以是「建议合并」

工程治理规则检查结果将在用户消息中提供，仅作为参考信号。禁止「存在违反 = 不建议合并」，必须按治理规则的 severity 判断：
- critical / high 违反 → 不建议合并
- medium 违反 → 需要人工重点检查，或建议合并（须在理由中说明需确认项）
- low 违反 → 建议合并（须在理由中说明轻微问题）

你必须用中文输出以下 Markdown 结构，不得省略任何章节：

# AI评审结果

## 风险等级
（低 / 中 / 高 / 严重 之一）

## 关键发现
- （基于 Diff 与 findings 的真实发现，无则写「未发现显著风险」）

## 工程治理检查
- 规则名：通过 | 违反

## Review建议
Reviewer 应重点检查：
- （具体可操作的检查点）

## 评审结论
合并建议：建议合并 | 需要人工重点检查 | 需要修改 | 不建议合并
理由：
（一句话说明，须引用治理与 findings；不得编造未出现的问题）

「合并建议」行只能使用上述四个枚举值之一，禁止其它表达。必须仅基于用户提供的 Diff、findings 与工程治理判定。`
}

export function buildAiReviewUserPrompt(params: AiReviewUserPromptParams): string {
  const {
    title,
    repo,
    sourceBranch,
    targetBranch,
    filesChanged,
    additions,
    deletions,
    diffTruncated,
    governanceText,
    findingsContext,
    diffContext,
  } = params

  return `请评审这个合并请求。

PR 标题：${title}
仓库：${repo}
分支：${sourceBranch} -> ${targetBranch}
变更规模：${filesChanged} 文件，+${additions} -${deletions}
${diffTruncated ? "\n（Diff 已按上下文预算截断，请基于可见部分评审）\n" : ""}

工程治理规则检查结果：
${governanceText}

规则扫描 findings：
${findingsContext}

Diff 摘要：
${diffContext || "（无 diff 内容）"}`
}
