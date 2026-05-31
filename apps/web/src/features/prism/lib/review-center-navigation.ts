/** @deprecated All review center URLs map to the single inbox view. */
export type ReviewCenterTab = "inbox"

export function normalizeReviewTab(_tab: string | null | undefined): ReviewCenterTab {
  return "inbox"
}
