"use client"

import type { Repository, PullRequest } from "@reviewly/shared"

import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

const badgeBase =
  "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border"

export function RepositorySourceBadge({
  sourceType,
  className,
}: {
  sourceType?: Repository["sourceType"] | PullRequest["sourceType"]
  className?: string
}) {
  if (sourceType === "external") {
    return (
      <span
        className={cn(
          badgeBase,
          "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
          className,
        )}
        title={zh.repos.externalRepoHint}
      >
        {zh.repos.externalRepoBadge}
      </span>
    )
  }
  if (sourceType === "github") {
    return (
      <span
        className={cn(
          badgeBase,
          "bg-surface-3 text-muted-foreground border-border",
          className,
        )}
      >
        {zh.repos.sourceBadgeGithub}
      </span>
    )
  }
  return null
}

export function RepositoryManagedBadge({
  managed,
  className,
}: {
  managed?: boolean
  className?: string
}) {
  if (managed === true) {
    return (
      <span
        className={cn(
          badgeBase,
          "bg-ai-purple/15 text-ai-purple border-ai-purple/30",
          className,
        )}
      >
        {zh.repos.managedBadge}
      </span>
    )
  }
  if (managed === false) {
    return (
      <span
        className={cn(
          badgeBase,
          "bg-risk-medium/10 text-risk-medium border-risk-medium/25",
          className,
        )}
      >
        {zh.repos.unmanagedBadge}
      </span>
    )
  }
  return null
}

export function RepositoryBadges({
  sourceType,
  managed,
  className,
}: {
  sourceType?: Repository["sourceType"] | PullRequest["sourceType"]
  managed?: boolean
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <RepositorySourceBadge sourceType={sourceType} />
      <RepositoryManagedBadge managed={managed} />
    </span>
  )
}
