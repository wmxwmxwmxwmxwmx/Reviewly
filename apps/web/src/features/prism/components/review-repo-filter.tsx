"use client"

import type { RepoReviewGroup } from "@reviewly/shared"
import { FolderGit2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface ReviewRepoFilterProps {
  groups: RepoReviewGroup[]
  selectedRepoId: string | null
  onSelectRepo: (repoId: string | null) => void
  loading?: boolean
  className?: string
}

export function ReviewRepoFilter({
  groups,
  selectedRepoId,
  onSelectRepo,
  loading,
  className,
}: ReviewRepoFilterProps) {
  const flatRepos = groups.flatMap((g) =>
    g.repos.map((r) => ({ ...r, groupLabel: g.label })),
  )

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
      <select
        value={selectedRepoId ?? ""}
        onChange={(e) => onSelectRepo(e.target.value ? e.target.value : null)}
        disabled={loading}
        className={cn(
          "h-8 min-w-0 max-w-[10rem] sm:max-w-[14rem] flex-1 text-xs",
          "bg-surface-2 border border-border rounded-md px-2 text-foreground",
          "focus:outline-none focus:ring-1 focus:ring-ai-blue",
          loading && "opacity-60",
        )}
        aria-label="筛选仓库"
      >
        <option value="">全部仓库</option>
        {flatRepos.map((repo) => (
          <option key={repo.id} value={repo.id}>
            {repo.groupLabel ? `${repo.groupLabel} / ` : ""}
            {repo.name} ({repo.prCount})
          </option>
        ))}
      </select>
    </div>
  )
}
