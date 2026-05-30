import type { FindingCategory } from "@reviewly/shared"

export type { FindingCategory }

/** Short tab labels for risk center filter bar */
export const RISK_CATEGORY_TABS: { id: FindingCategory | "all"; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "security", label: "安全" },
  { id: "performance", label: "性能" },
  { id: "architecture", label: "架构" },
  { id: "maintainability", label: "维护性" },
  { id: "convention", label: "规范" },
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
