import type { Repository } from "@reviewly/shared"

export const REPO_ANALYSIS_SYSTEM_PROMPT =
  "你是资深架构师与代码评审专家。仅基于用户提供的仓库元数据、目录树、配置文件、findings 与 README 分析；禁止编造未在上下文中出现的文件路径或依赖。输出必须严格遵循用户指定的 Markdown 表格模板，禁止用有序列表代替表格。"

type RepoFinding = {
  title: string
  severity: string
  file: string
  line: number
  description?: string
}

type AnalyzeContext = {
  readme: string
  fileTree?: string
  configSnippets?: Record<string, string>
  contextWarnings?: string[]
}

export function buildAnalyzePrompt(
  repo: Repository,
  findings: RepoFinding[],
  ctx: AnalyzeContext,
): string {
  const findingsBlock =
    findings.length > 0
      ? findings
          .map(
            (f) =>
              `- [${f.severity}] ${f.file}:${f.line} ${f.title}\n  ${f.description ?? ""}`,
          )
          .join("\n")
      : "（暂无 PR 分析 findings）"

  const warningsBlock =
    ctx.contextWarnings && ctx.contextWarnings.length > 0
      ? ctx.contextWarnings.map((w) => `- ${w}`).join("\n")
      : "（无）"

  const configBlock =
    ctx.configSnippets && Object.keys(ctx.configSnippets).length > 0
      ? Object.entries(ctx.configSnippets)
          .map(([path, body]) => `### ${path}\n\`\`\`\n${body}\n\`\`\``)
          .join("\n\n")
      : "（未获取到 package.json / pyproject.toml 等配置文件）"

  return `请分析以下 GitHub 仓库，用中文 Markdown 输出。必须严格按下列四个二级标题顺序输出，每个章节内优先使用 GFM 表格（禁止有序/无序列表作为主结构，禁止在各章节内从 1 重新编号）。

## 执行摘要
| 维度 | 等级 | 结论 |
| --- | --- | --- |
| 架构复杂度 | 高/中/低 | （Monorepo/模块边界/跨服务通信，≤30 字） |
| 功能复杂度 | 高/中/低 | （业务域数量与耦合，≤30 字） |
| 整体风险 | 高/中/低 | （结合 findings 与目录，≤30 字） |
| 可维护性 | 高/中/低 | （测试/文档/构建链，≤30 字） |

## 架构与技术栈
| 组件 | 路径 | 技术栈 | 职责 |
| --- | --- | --- | --- |
（Monorepo 每个子项目一行；路径必须来自目录树；无数据写「数据不足」）

## 风险热点
| 模块/路径 | 风险类型 | 严重度 | 关注点 |
| --- | --- | --- | --- |
（优先引用下方 findings；若无显著风险，保留表头并写一行「暂无显著风险 | — | 低 | —」）

## 可维护性
| 指标 | 现状 | 建议动作 |
| --- | --- | --- |
（测试、文档、依赖升级、CI、模块耦合等；每条建议可执行，≤25 字）

写作要求：
- 表格单元格精炼，避免长段落；同一章节不要重复表头
- 等级列仅允许：高、中、低
- 必须基于下方 README、目录树、配置文件与 findings；禁止仅根据仓库名猜测
- 若某类数据缺失，在对应单元格写「数据不足」并给出有限结论

仓库：${repo.fullName}
描述：${repo.description ?? "（无）"}
语言（GitHub）：${repo.language ?? "（未知）"}
默认分支：${repo.defaultBranch}
开放 PR 数：${repo.openPrCount}
健康度：${repo.healthScore}
是否私有：${repo.isPrivate ? "是" : "否"}

上下文告警：
${warningsBlock}

最近 PR Findings：
${findingsBlock}

仓库文件路径（节选）：
${ctx.fileTree?.trim() || "（无法获取目录树）"}

关键配置文件：
${configBlock}

README（节选）：
${ctx.readme?.trim() || "（无法获取 README）"}`
}
