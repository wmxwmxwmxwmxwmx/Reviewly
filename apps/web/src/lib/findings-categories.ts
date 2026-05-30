import type { FindingCategory } from "@reviewly/shared"

export type { FindingCategory }

export const RISK_CATEGORIES: {
  id: FindingCategory
  label: string
  icon: string
  countTone: string
}[] = [
  { id: "security", label: "安全问题", icon: "🔒", countTone: "text-risk-high" },
  { id: "performance", label: "性能问题", icon: "⚡", countTone: "text-ai-blue" },
  { id: "architecture", label: "架构问题", icon: "🏗", countTone: "text-ai-purple" },
  { id: "maintainability", label: "可维护性", icon: "🔧", countTone: "text-risk-medium" },
  { id: "convention", label: "规范问题", icon: "📋", countTone: "text-muted-foreground" },
]

export const EMPTY_CATEGORY_COUNTS: Record<FindingCategory, number> = {
  security: 0,
  performance: 0,
  architecture: 0,
  maintainability: 0,
  convention: 0,
}

export function parseFindingsCategory(
  tab: string | null | undefined,
): FindingCategory | null {
  if (!tab || tab === "all") return null
  if (
    tab === "security" ||
    tab === "performance" ||
    tab === "architecture" ||
    tab === "maintainability" ||
    tab === "convention"
  ) {
    return tab
  }
  return null
}
