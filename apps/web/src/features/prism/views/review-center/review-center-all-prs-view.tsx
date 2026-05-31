"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Search } from "lucide-react"
import type { PullRequestListItem, ReviewStatus } from "@reviewly/shared"
import type { RepoReviewGroup } from "@reviewly/shared"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { EditPRDialog } from "@/features/prism/components/edit-pr-dialog"
import { ReviewPrList } from "@/features/prism/components/review-pr-list"
import { ReviewRepoFilter } from "@/features/prism/components/review-repo-filter"
import { ReviewStatusTabs } from "@/features/prism/components/review-status-tabs"
import { useAuth } from "@/features/prism/contexts/auth-context"
import type { ReviewPrFilter } from "@/features/prism/lib/review-center-navigation"
import { usePullRequests } from "@/hooks/use-pull-requests"
import { useToast } from "@/hooks/use-toast"
import { deletePullRequest, patchPullRequest } from "@/lib/api/pull-requests"
import { PrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"

interface ReviewCenterAllPrsViewProps {
  onSelectPr: (prId: string) => void
  reloadToken?: number
  repoId?: string
  repoGroups: RepoReviewGroup[]
  groupsLoading?: boolean
  onRepoChange: (repoId: string | null) => void
  onImportOpenChange: (open: boolean) => void
  initialStatus?: ReviewStatus | "ALL"
  prFilter?: ReviewPrFilter
}

export function ReviewCenterAllPrsView({
  onSelectPr,
  reloadToken = 0,
  repoId,
  repoGroups,
  groupsLoading,
  onRepoChange,
  onImportOpenChange,
  initialStatus = "ALL",
  prFilter,
}: ReviewCenterAllPrsViewProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "ALL">(initialStatus)
  const [search, setSearch] = useState("")

  useEffect(() => {
    setStatusFilter(initialStatus)
  }, [initialStatus])

  const { items, statusCounts, loading, error, reload } = usePullRequests({
    includeExternal: "true",
    limit: "100",
    includeCounts: "true",
    repoId: repoId || undefined,
    reviewStatus: statusFilter !== "ALL" ? statusFilter : undefined,
    search: search.trim() || undefined,
    filter: prFilter === "high-risk" ? "high-risk" : undefined,
    author: prFilter === "my-created" ? user?.username : undefined,
  })

  const [editPr, setEditPr] = useState<PullRequestListItem | null>(null)
  const [deletePr, setDeletePr] = useState<PullRequestListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(null)

  useEffect(() => {
    if (reloadToken > 0) reload()
  }, [reloadToken, reload])

  const filtered = useMemo(
    () =>
      [...items].sort((a, b) => {
        const favDiff = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))
        if (favDiff !== 0) return favDiff
        return (b.updatedAt || "").localeCompare(a.updatedAt || "")
      }),
    [items],
  )

  const activePresetLabel =
    prFilter === "high-risk"
      ? "高风险 PR"
      : prFilter === "my-created"
        ? "我创建的 PR"
        : null

  const toggleFavorite = useCallback(
    async (pr: PullRequestListItem) => {
      setTogglingFavoriteId(pr.id)
      try {
        await patchPullRequest(pr.id, { favorite: !pr.favorite })
        reload()
      } catch (e) {
        toast({
          title: zh.aiReview.favoriteFailed,
          description: e instanceof PrismApiError ? e.message : undefined,
          variant: "destructive",
        })
      } finally {
        setTogglingFavoriteId(null)
      }
    },
    [reload, toast],
  )

  const confirmDelete = useCallback(async () => {
    if (!deletePr || deleting) return
    setDeleting(true)
    try {
      await deletePullRequest(deletePr.id)
      toast({ title: zh.aiReview.deleteSuccess })
      reload()
      setDeletePr(null)
    } catch (e) {
      toast({
        title: zh.aiReview.deleteFailed,
        description: e instanceof PrismApiError ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }, [deletePr, deleting, toast, reload])

  const importEmptyAction = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0 h-7 text-xs"
      onClick={() => onImportOpenChange(true)}
    >
      <Plus className="w-3.5 h-3.5" />
      {zh.aiReview.importButton}
    </Button>
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h2 className="text-sm font-semibold text-foreground shrink-0">All PRs</h2>
          <span className="text-xs text-muted-foreground font-mono">
            {loading ? zh.common.loading : `${filtered.length} 条`}
          </span>
          <ReviewRepoFilter
            groups={repoGroups}
            selectedRepoId={repoId ?? null}
            onSelectRepo={onRepoChange}
            loading={groupsLoading}
            className="sm:ml-2"
          />
          <div className="relative flex-1 min-w-[10rem] sm:max-w-xs sm:ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题、编号、仓库、作者…"
              className="w-full h-8 pl-8 pr-3 text-xs bg-surface-2 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ai-blue"
            />
          </div>
        </div>

        <ReviewStatusTabs active={statusFilter} counts={statusCounts} onChange={setStatusFilter} />

        {activePresetLabel ? (
          <span className="inline-block text-[11px] px-2 py-0.5 rounded border border-ai-blue/30 bg-ai-blue/10 text-ai-blue">
            筛选：{activePresetLabel}
          </span>
        ) : null}

        <ReviewPrList
          items={filtered}
          loading={loading}
          error={error}
          variant="linear"
          onSelect={onSelectPr}
          onFavorite={(pr) => void toggleFavorite(pr)}
          onEdit={setEditPr}
          onDelete={setDeletePr}
          togglingFavoriteId={togglingFavoriteId}
          emptyAction={importEmptyAction}
        />
      </div>

      <EditPRDialog
        pr={editPr}
        open={Boolean(editPr)}
        onOpenChange={(open) => {
          if (!open) setEditPr(null)
        }}
        onSaved={reload}
      />

      <AlertDialog open={Boolean(deletePr)} onOpenChange={(open) => !open && setDeletePr(null)}>
        <AlertDialogContent className="bg-panel border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>{zh.aiReview.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{zh.aiReview.deleteConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{zh.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : zh.aiReview.deleteAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
