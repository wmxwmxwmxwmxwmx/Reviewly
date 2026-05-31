"use client"

import { CheckCircle2, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { openGitHubReview } from "@/lib/github-pr-url"
import type { PullRequest } from "@reviewly/shared"
import { cn } from "@/lib/utils"

type ReviewCompletionBannerProps = {
  pr: PullRequest
  highRiskCount: number
  className?: string
}

export function ReviewCompletionBanner({
  pr,
  highRiskCount,
  className,
}: ReviewCompletionBannerProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-ai-blue/25 bg-ai-blue/5 px-3 py-3 space-y-2",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-risk-low shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">AI 分析完成</p>
          <p className="text-[12px] text-muted-foreground">
            {highRiskCount > 0
              ? `已发现 ${highRiskCount} 个高风险问题`
              : "未发现高风险问题"}
          </p>
          <p className="text-[12px] text-muted-foreground">
            请前往 GitHub 完成最终评审
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="w-full gap-1.5 bg-ai-blue hover:bg-sky-300 text-primary-foreground"
        onClick={() => openGitHubReview(pr)}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        在 GitHub Review
      </Button>
    </div>
  )
}
