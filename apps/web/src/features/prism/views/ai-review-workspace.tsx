"use client"

import { useCallback, useState } from "react"
import { ArrowLeft, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ExternalRepoOnboardDialog } from "@/features/prism/components/external-repo-onboard-dialog"
import { AiReviewOverview } from "@/features/prism/views/ai-review-overview"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { AIReviewView } from "@/features/prism/views/ai-review-view"
import { useImportPrByUrl } from "@/hooks/use-import-pr-by-url"
import { usePullRequest } from "@/hooks/use-pull-request"
import { useRunningTask } from "@/features/prism/contexts/running-tasks-context"
import { useToast } from "@/hooks/use-toast"
import { zh } from "@/lib/i18n/zh"

interface AiReviewWorkspaceProps {
  prId: string | null
  onMenuClick?: () => void
  aiPanelOpen?: boolean
  onToggleAIPanel?: () => void
}

export function AiReviewWorkspace({
  prId,
  onMenuClick,
  aiPanelOpen = true,
  onToggleAIPanel,
}: AiReviewWorkspaceProps) {
  const { navigate, repoId: urlRepoId } = useNavigation()
  const { refresh: refreshRepos } = useReposStore()
  const { data: currentPr } = usePullRequest(prId)
  const { toast } = useToast()
  const [importOpen, setImportOpen] = useState(false)
  const [historyReloadToken, setHistoryReloadToken] = useState(0)

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

  const overviewRepoId = currentPr?.repoId ?? urlRepoId ?? undefined

  const handleSelectPr = useCallback(
    (id: string) => {
      navigate("ai-review", { prId: id, repoId: overviewRepoId })
    },
    [navigate, overviewRepoId],
  )

  const handleBackToList = useCallback(() => {
    navigate("ai-review", { aiReviewList: true, repoId: overviewRepoId })
  }, [navigate, overviewRepoId])

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
        <AiReviewOverview
          onMenuClick={onMenuClick}
          onSelectPr={handleSelectPr}
          importOpen={importOpen}
          onImportOpenChange={setImportOpen}
          importing={importing}
          onImport={handleImport}
          reloadToken={historyReloadToken}
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
          {zh.aiReview.backToList}
        </Button>
        {currentPr ? (
          <span className="text-sm text-muted-foreground truncate hidden sm:inline">
            {currentPr.displayName?.trim() || currentPr.title}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AIReviewView
          key={prId}
          prId={prId}
          aiPanelOpen={aiPanelOpen}
          onToggleAIPanel={onToggleAIPanel}
        />
      </div>
    </div>
  )
}
