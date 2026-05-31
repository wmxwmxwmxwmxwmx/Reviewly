import type { ReviewInboxItem } from "@/features/prism/types/review-task"

export type RepoInboxGroup = {
  repo: string
  items: ReviewInboxItem[]
}

export function groupInboxItemsByRepo(items: ReviewInboxItem[]): RepoInboxGroup[] {
  const map = new Map<string, ReviewInboxItem[]>()
  for (const item of items) {
    const list = map.get(item.repo) ?? []
    list.push(item)
    map.set(item.repo, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([repo, groupItems]) => ({ repo, items: groupItems }))
}
