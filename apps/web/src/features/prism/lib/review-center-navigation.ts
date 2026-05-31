import type { ReviewStatus } from "@reviewly/shared"

import type { ReviewCenterTab } from "@/features/prism/components/review-center-nav"

export type ReviewPrFilter = "high-risk" | "my-created"

export type WorkbenchNavigatePayload = {
  tab: ReviewCenterTab
  reviewStatus?: ReviewStatus
  prFilter?: ReviewPrFilter
}

const REVIEW_STATUSES: ReviewStatus[] = [
  "OPEN",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "MERGED",
  "CLOSED",
]

const PR_FILTERS: ReviewPrFilter[] = ["high-risk", "my-created"]

const VALID_TABS: ReviewCenterTab[] = ["inbox", "all", "insights"]

/** Map legacy reviewTab query values to Linear 3-tab model. */
export function normalizeReviewTab(tab: string | null | undefined): ReviewCenterTab {
  if (!tab) return "inbox"
  if (VALID_TABS.includes(tab as ReviewCenterTab)) {
    return tab as ReviewCenterTab
  }
  switch (tab) {
    case "pending":
    case "dashboard":
      return "inbox"
    case "stats":
    case "rules":
    case "settings":
    case "governance":
      return "insights"
    case "all":
      return "all"
    default:
      return "inbox"
  }
}

export function parseReviewStatusParam(value: string | null): ReviewStatus | null {
  if (!value || value === "ALL") return null
  return REVIEW_STATUSES.includes(value as ReviewStatus) ? (value as ReviewStatus) : null
}

export function parsePrFilterParam(value: string | null): ReviewPrFilter | null {
  if (!value) return null
  return PR_FILTERS.includes(value as ReviewPrFilter) ? (value as ReviewPrFilter) : null
}
