"use client"

import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { openGitHubReview } from "@/lib/github-pr-url"
import type { PullRequest } from "@reviewly/shared"
import { cn } from "@/lib/utils"

type ReviewCompletionBannerProps = {
  pr: PullRequest
  highRiskCount?: number
  className?: string
}

export function ReviewCompletionBanner({
  pr,
  className,
}: ReviewCompletionBannerProps) {
  return (
    <Button
      type="button"
      size="sm"
      className={cn(
        "w-full gap-1.5 bg-ai-blue hover:bg-sky-300 text-primary-foreground",
        className,
      )}
      onClick={() => openGitHubReview(pr)}
    >
      <ExternalLink className="w-3.5 h-3.5" />
      在 GitHub Review
    </Button>
  )
}
