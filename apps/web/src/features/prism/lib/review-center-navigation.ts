import type { ReviewCenterTab } from "@/features/prism/components/review-center-nav"

const VALID_TABS: ReviewCenterTab[] = ["inbox", "history"]

export function normalizeReviewTab(tab: string | null | undefined): ReviewCenterTab {
  if (!tab) return "inbox"
  if (VALID_TABS.includes(tab as ReviewCenterTab)) {
    return tab as ReviewCenterTab
  }
  if (tab === "done" || tab === "processed" || tab === "processing") return "history"
  return "inbox"
}
