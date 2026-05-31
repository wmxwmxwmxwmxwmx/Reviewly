import type { ReviewCenterTab } from "@/features/prism/components/review-center-nav"

const VALID_TABS: ReviewCenterTab[] = ["inbox", "processing", "done"]

/** Map legacy reviewTab query values to Copilot 3-tab model. */
export function normalizeReviewTab(tab: string | null | undefined): ReviewCenterTab {
  if (!tab) return "inbox"
  if (VALID_TABS.includes(tab as ReviewCenterTab)) {
    return tab as ReviewCenterTab
  }
  switch (tab) {
    case "pending":
    case "dashboard":
      return "inbox"
    case "all":
      return "processing"
    case "done":
    case "stats":
    case "rules":
    case "settings":
    case "governance":
    case "insights":
      return "done"
    default:
      return "inbox"
  }
}
