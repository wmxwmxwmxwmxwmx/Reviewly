/** 性能发现类型（引擎/API 英文标识 → 界面中文） */
const PERF_TYPE_ZH: Record<string, string> = {
  "Blocking IO": "阻塞 IO",
  "Large Object Copy": "大对象拷贝",
  "Duplicate DB Query": "重复数据库查询",
  "High Complexity Loop": "高复杂度循环",
  "Unnecessary String Copy": "不必要的字符串拷贝",
  "Unused Move": "未使用的 Move",
  "N+1 Query": "N+1 查询",
}

export function formatPerfType(type: string): string {
  const trimmed = type.trim()
  if (!trimmed) return ""
  return PERF_TYPE_ZH[trimmed] ?? trimmed
}

export const PERF_TYPE_FILTER_OPTIONS = [
  "",
  "Blocking IO",
  "Large Object Copy",
  "Duplicate DB Query",
  "High Complexity Loop",
  "Unnecessary String Copy",
  "Unused Move",
  "N+1 Query",
] as const
