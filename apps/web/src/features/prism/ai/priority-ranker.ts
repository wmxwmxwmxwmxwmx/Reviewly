/** @deprecated Use review-attention-score.ts */
export {
  computeInboxItems as computePriority,
  filterInboxItems,
  filterHistoryItems,
  belongsInInbox,
  belongsInHistory,
  type PrMetrics,
} from "@/features/prism/ai/review-attention-score"

import type { ReviewInboxItem } from "@/features/prism/types/review-task"

/** @deprecated */
export function filterTasksByQueue(
  tasks: ReviewInboxItem[],
  queue: string,
): ReviewInboxItem[] {
  if (queue === "done" || queue === "history") {
    return tasks.filter((t) => t.attentionState === "reviewed")
  }
  return tasks.filter((t) => t.attentionState !== "reviewed")
}

/** @deprecated */
export function shouldShowInInbox(): boolean {
  return true
}

/** @deprecated */
export function getNextInboxTask(
  tasks: ReviewInboxItem[],
  currentPrId: string | null,
): ReviewInboxItem | null {
  const inbox = tasks.filter((t) => t.attentionState === "unread")
  if (inbox.length === 0) return null
  if (!currentPrId) return inbox[0] ?? null
  const idx = inbox.findIndex((t) => t.prId === currentPrId)
  if (idx >= 0 && idx + 1 < inbox.length) return inbox[idx + 1] ?? null
  return inbox[0] ?? null
}
