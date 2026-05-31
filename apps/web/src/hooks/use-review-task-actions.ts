"use client"

import { useCallback } from "react"

type UseOpenReviewOptions = {
  onSelectPr: (prId: string) => void
}

/** Opens PR detail only — no GitHub approval actions in Reviewly. */
export function useOpenReview({ onSelectPr }: UseOpenReviewOptions) {
  const handleOpenReview = useCallback(
    (prId: string) => {
      onSelectPr(prId)
    },
    [onSelectPr],
  )

  return { handleOpenReview }
}

/** @deprecated Use useOpenReview */
export function useReviewTaskActions(options: {
  onSelectPr: (prId: string) => void
}) {
  const { handleOpenReview } = useOpenReview(options)
  return {
    handleReview: (task: { prId: string }) => handleOpenReview(task.prId),
    handleOpenReview,
  }
}
