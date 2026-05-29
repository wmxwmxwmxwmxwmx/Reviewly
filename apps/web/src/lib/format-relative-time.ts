const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** 将 ISO 时间格式化为中文相对时间（如「3 小时前」）。 */
export function formatRelativeTime(iso: string | undefined | null): string {
  if (!iso) return "时间未知"

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return "刚刚"

  if (diffMs < MINUTE_MS) return "刚刚"
  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS)
    return `${minutes} 分钟前`
  }
  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS)
    return `${hours} 小时前`
  }
  if (diffMs < DAY_MS * 7) {
    const days = Math.floor(diffMs / DAY_MS)
    return `${days} 天前`
  }

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  })
}
