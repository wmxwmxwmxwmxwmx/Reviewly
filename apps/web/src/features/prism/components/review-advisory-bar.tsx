"use client"

import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ReviewInboxItem } from "@/features/prism/types/review-task"
import { openGitHubReview } from "@/lib/github-pr-url"
import { cn } from "@/lib/utils"

type ReviewAdvisoryBarProps = {
  task: ReviewInboxItem
  suggestedLabel?: string
  layout?: "inline" | "panel"
  className?: string
}

export function ReviewAdvisoryBar({
  task,
  suggestedLabel,
  layout = "inline",
  className,
}: ReviewAdvisoryBarProps) {
  const isPanel = layout === "panel"
  const label = suggestedLabel ?? task.advisoryAction

  return (
    <div
      className={cn(
        isPanel ? "flex flex-col gap-2" : "flex flex-col gap-1.5",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {isPanel ? (
        <p className="text-[11px] text-muted-foreground mb-1">
          AI 建议：
          <span className="text-foreground font-medium">{label}</span>
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        className={cn(
          "gap-1.5 bg-ai-blue hover:bg-sky-300 text-primary-foreground",
          isPanel ? "w-full h-9" : "h-7 text-[11px] px-2.5",
        )}
        onClick={() => openGitHubReview(task.source)}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        在 GitHub Review
      </Button>
    </div>
  )
}
