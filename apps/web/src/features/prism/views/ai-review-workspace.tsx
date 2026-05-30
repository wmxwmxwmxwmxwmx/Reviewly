"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ExternalRepoOnboardDialog } from "@/features/prism/components/external-repo-onboard-dialog"
import type { ReviewCenterTab } from "@/features/prism/components/review-center-nav"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { AIReviewView } from "@/features/prism/views/ai-review-view"
import { ReviewCenterShell } from "@/features/prism/views/review-center/review-center-shell"
import { useImportPrByUrl } from "@/hooks/use-import-pr-by-url"
import { usePullRequest } from "@/hooks/use-pull-request"
import { useRunningTask } from "@/features/prism/contexts/running-tasks-context"
import { useToast } from "@/hooks/use-toast"
import type { WorkbenchNavigatePayload } from "@/features/prism/lib/review-center-navigation"
import {
  parsePrFilterParam,
  parseReviewStatusParam,
} from "@/features/prism/lib/review-center-navigation"
import { zh } from "@/lib/i18n/zh"

const REVIEW_TABS: ReviewCenterTab[] = [
  "dashboard",
  "pending",
  "all",
  "rules",
  "stats",
  "settings",
]

function parseReviewTab(value: string | null): ReviewCenterTab {
  if (value && (REVIEW_TABS as string[]).includes(value)) {
    return value as ReviewCenterTab
  }
  return "dashboard"
}

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
  const { navigate, repoId: urlRepoId, reviewStatus: reviewStatusParam, prFilter: prFilterParam } =
    useNavigation()
  const { refresh: refreshRepos } = useReposStore()
  const { data: currentPr } = usePullRequest(prId)
  const { toast } = useToast()
  const [importOpen, setImportOpen] = useState(false)
  const [historyReloadToken, setHistoryReloadToken] = useState(0)
  const [centerTab, setCenterTab] = useState<ReviewCenterTab>(
    parseReviewTab(reviewTabParam ?? null),
  )
  const [filterRepoId, setFilterRepoId] = useState<string | null>(urlRepoId)

  useEffect(() => {
    setCenterTab(parseReviewTab(reviewTabParam ?? null))
  }, [reviewTabParam])

  const bumpHistory = useCallback(() => {
    setHistoryReloadToken((n) => n + 1)
  }, [])

  const {
    importing,
    handleImportUrl,
    pendingOnboardRepoId,
    clearPendingOnboard,
  } = useImportPrByUrl({
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

  const overviewRepoId = currentPr?.repoId ?? filterRepoId ?? urlRepoId ?? undefined

  const listReviewStatus = parseReviewStatusParam(reviewStatusParam)
  const listPrFilter = parsePrFilterParam(prFilterParam)

  const handleSelectPr = useCallback(
    (id: string) => {
      navigate("ai-review", {
        prId: id,
        repoId: overviewRepoId,
        reviewTab: centerTab,
        reviewStatus: listReviewStatus ?? undefined,
        prFilter: listPrFilter ?? undefined,
      })
    },
    [navigate, overviewRepoId, centerTab, listReviewStatus, listPrFilter],
  )

  const handleBackToList = useCallback(() => {
    navigate("ai-review", {
      aiReviewList: true,
      repoId: overviewRepoId,
      reviewTab: centerTab,
      reviewStatus: listReviewStatus ?? undefined,
      prFilter: listPrFilter ?? undefined,
    })
  }, [navigate, overviewRepoId, centerTab, listReviewStatus, listPrFilter])

  const handleTabChange = useCallback(
    (tab: ReviewCenterTab) => {
      setCenterTab(tab)
      navigate("ai-review", { aiReviewList: true, repoId: filterRepoId ?? undefined, reviewTab: tab })
    },
    [navigate, filterRepoId],
  )

  const handleWorkbenchNavigate = useCallback(
    (payload: WorkbenchNavigatePayload) => {
      setCenterTab(payload.tab)
      navigate("ai-review", {
        aiReviewList: true,
        repoId: filterRepoId ?? undefined,
        reviewTab: payload.tab,
        reviewStatus: payload.reviewStatus,
        prFilter: payload.prFilter,
      })
    },
    [navigate, filterRepoId],
  )

  const handleNavigateFindings = useCallback(() => {
    navigate("findings")
  }, [navigate])

  const handleRepoChange = useCallback(
    (repoId: string | null) => {
      setFilterRepoId(repoId)
      navigate("ai-review", { aiReviewList: true, repoId: repoId ?? undefined, reviewTab: centerTab })
    },
    [navigate, centerTab],
  )

  const handleImport = useCallback(
    async (url: string) => {
      await handleImportUrl(url)
    },
    [handleImportUrl],
  )

  if (!prId) {
    return (
      <>
        <ExternalRepoOnboardDialog
          repoId={pendingOnboardRepoId}
          open={Boolean(pendingOnboardRepoId)}
          onOpenChange={(open) => {
            if (!open) clearPendingOnboard()
          }}
          onOnboarded={() => void refreshRepos()}
        />
        <ReviewCenterShell
          activeTab={centerTab}
          onTabChange={handleTabChange}
          onMenuClick={onMenuClick}
          onSelectPr={handleSelectPr}
          onWorkbenchNavigate={handleWorkbenchNavigate}
          onNavigateFindings={handleNavigateFindings}
          listReviewStatus={listReviewStatus}
          listPrFilter={listPrFilter}
          importOpen={importOpen}
          onImportOpenChange={setImportOpen}
          importing={importing}
          onImport={handleImport}
          reloadToken={historyReloadToken}
          repoId={filterRepoId ?? urlRepoId}
          onRepoChange={handleRepoChange}
        />
      </>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      <ExternalRepoOnboardDialog
        repoId={pendingOnboardRepoId}
        open={Boolean(pendingOnboardRepoId)}
        onOpenChange={(open) => {
          if (!open) clearPendingOnboard()
        }}
        repoLabel={currentPr?.repo}
        onOnboarded={() => void refreshRepos()}
      />

      <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 border-b border-border bg-panel/95 backdrop-blur-sm shrink-0">
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
