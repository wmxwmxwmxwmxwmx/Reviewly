"use client"

import type { RepoReviewGroup } from "@reviewly/shared"
import { FolderGit2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReviewRepoSidebarProps {
  groups: RepoReviewGroup[]
  selectedRepoId: string | null
  onSelectRepo: (repoId: string | null) => void
  loading?: boolean
}

export function ReviewRepoSidebar({
  groups,
  selectedRepoId,
  onSelectRepo,
  loading,
}: ReviewRepoSidebarProps) {
  return (
    <aside className="w-[200px] shrink-0 border-r border-border bg-panel/50 overflow-y-auto hidden lg:block">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground uppercase tracking-wide">
          <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground" />
          仓库
        </div>
      </div>
      <div className="p-2 space-y-3">
        <button
          type="button"
          onClick={() => onSelectRepo(null)}
          className={cn(
            "w-full text-left px-2.5 py-1.5 rounded-md text-[11px] transition-colors",
            selectedRepoId === null
              ? "bg-ai-blue/15 text-ai-blue"
              : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
          )}
        >
          全部仓库
        </button>
        {loading ? (
          <div className="px-2 text-[10px] text-muted-foreground">加载中…</div>
        ) : (
          groups.map((group) => (
            <div key={group.id}>
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.repos.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => onSelectRepo(repo.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition-colors",
                      selectedRepoId === repo.id
                        ? "bg-ai-blue/15 text-ai-blue"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{repo.name}</span>
                    <span className="font-mono text-[10px] shrink-0">{repo.prCount}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
