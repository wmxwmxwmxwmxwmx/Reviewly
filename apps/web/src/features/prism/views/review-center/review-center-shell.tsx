"use client"

import { Menu, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ImportPRDialog } from "@/features/prism/components/import-pr-dialog"
import {
  ReviewCenterNav,
  type ReviewCenterTab,
} from "@/features/prism/components/review-center-nav"
import { ReviewCenterDoneView } from "@/features/prism/views/review-center/review-center-done-view"
import { ReviewCenterInboxView } from "@/features/prism/views/review-center/review-center-inbox-view"
import { ReviewCenterProcessingView } from "@/features/prism/views/review-center/review-center-processing-view"
import { zh } from "@/lib/i18n/zh"

interface ReviewCenterShellProps {
  activeTab: ReviewCenterTab
  onTabChange: (tab: ReviewCenterTab) => void
  onMenuClick?: () => void
  onSelectPr: (prId: string) => void
  importOpen: boolean
  onImportOpenChange: (open: boolean) => void
  importing: boolean
  onImport: (url: string) => Promise<void>
  reloadToken?: number
}

export function ReviewCenterShell({
  activeTab,
  onTabChange,
  onMenuClick,
  onSelectPr,
  importOpen,
  onImportOpenChange,
  importing,
  onImport,
  reloadToken,
}: ReviewCenterShellProps) {
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
      case "processing":
        return (
          <ReviewCenterProcessingView
            onSelectPr={onSelectPr}
            reloadToken={reloadToken}
          />
        )
      case "done":
        return (
          <ReviewCenterDoneView onSelectPr={onSelectPr} reloadToken={reloadToken} />
        )
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
          {onMenuClick ? (
            <button
              type="button"
              onClick={onMenuClick}
              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors shrink-0 lg:hidden"
              aria-label="打开菜单"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
          ) : null}
          <div>
            <h1 className="text-lg font-semibold text-foreground">AI PR Copilot</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              PR 优先队列 · 一键处理 · 可治理
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
