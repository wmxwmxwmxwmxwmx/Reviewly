"use client"

import { useEffect, useState } from "react"
import { Menu, Plus } from "lucide-react"
import type { RepoReviewGroup, ReviewStatus } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import { ImportPRDialog } from "@/features/prism/components/import-pr-dialog"
import {
  ReviewCenterNav,
  type ReviewCenterTab,
} from "@/features/prism/components/review-center-nav"
import { ReviewCenterAllPrsView } from "@/features/prism/views/review-center/review-center-all-prs-view"
import { ReviewCenterInboxView } from "@/features/prism/views/review-center/review-center-inbox-view"
import { ReviewCenterInsightsView } from "@/features/prism/views/review-center/review-center-insights-view"
import type { ReviewPrFilter } from "@/features/prism/lib/review-center-navigation"
import { fetchReviewRepoGroups } from "@/lib/api/review-center"
import { isAbortError, shouldApplyResult } from "@/lib/abort-utils"
import { zh } from "@/lib/i18n/zh"

interface ReviewCenterShellProps {
  activeTab: ReviewCenterTab
  onTabChange: (tab: ReviewCenterTab) => void
  onMenuClick?: () => void
  onSelectPr: (prId: string) => void
  listReviewStatus: ReviewStatus | null
  listPrFilter: ReviewPrFilter | null
  importOpen: boolean
  onImportOpenChange: (open: boolean) => void
  importing: boolean
  onImport: (url: string) => Promise<void>
  reloadToken?: number
  repoId?: string | null
  onRepoChange: (repoId: string | null) => void
}

export function ReviewCenterShell({
  activeTab,
  onTabChange,
  onMenuClick,
  onSelectPr,
  listReviewStatus,
  listPrFilter,
  importOpen,
  onImportOpenChange,
  importing,
  onImport,
  reloadToken,
  repoId,
  onRepoChange,
}: ReviewCenterShellProps) {
  const [repoGroups, setRepoGroups] = useState<RepoReviewGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)

  useEffect(() => {
    const ac = new AbortController()
    setGroupsLoading(true)
    void fetchReviewRepoGroups(ac.signal)
      .then((res) => {
        if (!shouldApplyResult(ac.signal)) return
        setRepoGroups(res.groups)
      })
      .catch((e) => {
        if (isAbortError(e) || !shouldApplyResult(ac.signal)) return
        setRepoGroups([])
      })
      .finally(() => {
        if (shouldApplyResult(ac.signal)) setGroupsLoading(false)
      })
    return () => ac.abort()
  }, [reloadToken])

  const content = (() => {
    switch (activeTab) {
      case "inbox":
        return (
          <ReviewCenterInboxView
            onSelectPr={onSelectPr}
            reloadToken={reloadToken}
            onImportOpenChange={onImportOpenChange}
          />
        )
      case "all":
        return (
          <ReviewCenterAllPrsView
            onSelectPr={onSelectPr}
            reloadToken={reloadToken}
            repoId={repoId ?? undefined}
            repoGroups={repoGroups}
            groupsLoading={groupsLoading}
            onRepoChange={onRepoChange}
            onImportOpenChange={onImportOpenChange}
            initialStatus={listReviewStatus ?? "ALL"}
            prFilter={listPrFilter ?? undefined}
          />
        )
      case "insights":
        return <ReviewCenterInsightsView />
      default:
        return (
          <ReviewCenterInboxView
            onSelectPr={onSelectPr}
            reloadToken={reloadToken}
            onImportOpenChange={onImportOpenChange}
          />
        )
    }
  })()

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <ImportPRDialog
        open={importOpen}
        onOpenChange={onImportOpenChange}
        importing={importing}
        onImport={onImport}
      />

      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border bg-panel/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors shrink-0 lg:hidden"
              aria-label="打开菜单"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-foreground">代码评审中心</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {zh.pageSubtitle.aiReview}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => onImportOpenChange(true)}
          className="bg-ai-blue hover:bg-sky-300 text-primary-foreground shrink-0"
        >
          <Plus className="w-4 h-4" />
          {zh.aiReview.importButton}
        </Button>
      </div>

      <ReviewCenterNav active={activeTab} onChange={onTabChange} />

      <div className="flex flex-1 min-w-0 overflow-hidden flex flex-col">{content}</div>
    </div>
  )
}
