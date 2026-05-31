"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ReviewCenterTab } from "@/features/prism/components/review-center-nav"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { AIReviewView } from "@/features/prism/views/ai-review-view"
import { ReviewCenterShell } from "@/features/prism/views/review-center/review-center-shell"
import { useImportPrByUrl } from "@/hooks/use-import-pr-by-url"
import { usePullRequest } from "@/hooks/use-pull-request"
import { useRunningTask } from "@/features/prism/contexts/running-tasks-context"
import { useToast } from "@/hooks/use-toast"
import { normalizeReviewTab } from "@/features/prism/lib/review-center-navigation"
import { zh } from "@/lib/i18n/zh"

interface AiReviewWorkspaceProps {
  prId: string | null
  reviewTab?: string | null
  onMenuClick?: () => void
}

export function AiReviewWorkspace({
  prId,
  reviewTab: reviewTabParam,
  onMenuClick,
}: AiReviewWorkspaceProps) {
  const { navigate, repoId: urlRepoId } = useNavigation()
  const { data: currentPr } = usePullRequest(prId)
  const { toast } = useToast()
  const [importOpen, setImportOpen] = useState(false)
  const [historyReloadToken, setHistoryReloadToken] = useState(0)
  const [centerTab, setCenterTab] = useState<ReviewCenterTab>(
    normalizeReviewTab(reviewTabParam),
  )

  useEffect(() => {
    setCenterTab(normalizeReviewTab(reviewTabParam))
  }, [reviewTabParam])

  const bumpHistory = useCallback(() => {
    setHistoryReloadToken((n) => n + 1)
  }, [])

  const { importing, handleImportUrl } = useImportPrByUrl({
    currentPrId: prId ?? undefined,
    onImportSuccess: () => {
      toast({ title: zh.aiReview.importSuccess })
      bumpHistory()
      setImportOpen(false)
    },
    onImportError: (message) => {
      toast({ title: zh.aiReview.importFailed, description: message, variant: "destructive" })
    },
    onSamePrImport: () => {
      toast({ title: zh.aiReview.importSuccess })
      bumpHistory()
      setImportOpen(false)
    },
  })

  useRunningTask("aiReview", importing)

  const handleSelectPr = useCallback(
    (id: string) => {
      navigate("ai-review", {
        prId: id,
        repoId: urlRepoId ?? undefined,
        reviewTab: centerTab,
      })
    },
    [navigate, urlRepoId, centerTab],
  )

  const handleBackToList = useCallback(() => {
    navigate("ai-review", {
      aiReviewList: true,
      repoId: urlRepoId ?? undefined,
      reviewTab: centerTab,
    })
  }, [navigate, urlRepoId, centerTab])

  const handleTabChange = useCallback(
    (tab: ReviewCenterTab) => {
      setCenterTab(tab)
      navigate("ai-review", { aiReviewList: true, reviewTab: tab })
    },
    [navigate],
  )

  const handleImport = useCallback(
    async (url: string) => {
      await handleImportUrl(url)
    },
    [handleImportUrl],
  )

  if (!prId) {
    return (
      <ReviewCenterShell
        activeTab={centerTab}
        onTabChange={handleTabChange}
        onMenuClick={onMenuClick}
        onSelectPr={handleSelectPr}
        importOpen={importOpen}
        onImportOpenChange={setImportOpen}
        importing={importing}
        onImport={handleImport}
        reloadToken={historyReloadToken}
      />
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 border-b border-border bg-panel/95 backdrop-blur-sm shrink-0">
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleBackToList}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          返回评审中心
        </Button>
        {currentPr ? (
          <span className="text-sm text-muted-foreground truncate hidden sm:inline">
            {currentPr.displayName?.trim() || currentPr.title}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AIReviewView key={prId} prId={prId} onReviewStatusChanged={bumpHistory} />
      </div>
    </div>
  )
}
