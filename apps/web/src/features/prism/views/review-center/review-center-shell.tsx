"use client"

import { Menu, Plus, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { ImportPRDialog } from "@/features/prism/components/import-pr-dialog"
import { ReviewCenterInboxView } from "@/features/prism/views/review-center/review-center-inbox-view"
import { useManagedRepoPrSyncLoop } from "@/hooks/use-managed-repo-pr-sync"
import { useReviewAttentionCounts } from "@/hooks/use-managed-repo-pr-sync"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface ReviewCenterShellProps {
  onMenuClick?: () => void
  onSelectPr: (prId: string) => void
  importOpen: boolean
  onImportOpenChange: (open: boolean) => void
  importing: boolean
  onImport: (url: string) => Promise<void>
  reloadToken?: number
}

export function ReviewCenterShell({
  onMenuClick,
  onSelectPr,
  importOpen,
  onImportOpenChange,
  importing,
  onImport,
  reloadToken,
}: ReviewCenterShellProps) {
  const { navigate } = useNavigation()
  const { reload: reloadCounts } = useReviewAttentionCounts()
  const { syncBadges } = useManagedRepoPrSyncLoop({
    enabled: true,
    onSynced: () => reloadCounts(),
  })

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
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-foreground">收件箱</h1>
              {syncBadges.newPrCount > 0 ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-ai-blue/15 text-ai-blue font-medium">
                  {syncBadges.newPrCount} 个新 PR 等待评审
                </span>
              ) : null}
              {syncBadges.revisitCount > 0 ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-risk-medium/15 text-risk-medium font-medium">
                  {syncBadges.revisitCount} 个 PR 需要重新查看
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              纳管 PR · AI 辅助评审 · 决策在 GitHub
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 hidden sm:inline-flex"
            onClick={() => navigate("governance")}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {zh.nav.governance}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onImportOpenChange(true)}
            className="bg-ai-blue hover:bg-sky-300 text-primary-foreground"
          >
            <Plus className="w-4 h-4" />
            {zh.aiReview.importButton}
          </Button>
        </div>
      </div>

      <div className={cn("flex flex-1 min-w-0 overflow-hidden flex flex-col")}>
        <ReviewCenterInboxView
          onSelectPr={onSelectPr}
          reloadToken={reloadToken}
          onImportOpenChange={onImportOpenChange}
        />
      </div>
    </div>
  )
}
