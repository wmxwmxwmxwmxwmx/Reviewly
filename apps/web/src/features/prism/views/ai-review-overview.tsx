"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Clock,
  GitPullRequest,
  Loader2,
  Menu,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react"
import type { PullRequestListItem } from "@reviewly/shared"

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
import { ImportPRDialog } from "@/features/prism/components/import-pr-dialog"
import { usePullRequests } from "@/hooks/use-pull-requests"
import { useToast } from "@/hooks/use-toast"
import { deletePullRequest, patchPullRequest } from "@/lib/api/pull-requests"
import { PrismApiError } from "@/lib/api/client"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

function formatPrState(state: PullRequestListItem["state"]) {
  if (state === "open") return "开放"
  if (state === "merged") return "已合并"
  return "已关闭"
}

function formatDate(iso?: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function prDisplayTitle(pr: PullRequestListItem) {
  return pr.displayName?.trim() || pr.title
}

function riskAccent(level: PullRequestListItem["riskLevel"]) {
  if (level === "critical" || level === "high") return "border-risk-high/30 bg-risk-high/5"
  if (level === "medium") return "border-amber-400/30 bg-amber-400/5"
  return "border-border bg-surface-2"
}

interface AiReviewOverviewProps {
  onMenuClick?: () => void
  onSelectPr: (prId: string) => void
  importOpen: boolean
  onImportOpenChange: (open: boolean) => void
  importing: boolean
  onImport: (url: string) => Promise<void>
  reloadToken?: number
}

export function AiReviewOverview({
  onMenuClick,
  onSelectPr,
  importOpen,
  onImportOpenChange,
  importing,
  onImport,
  reloadToken = 0,
}: AiReviewOverviewProps) {
  const { toast } = useToast()
  const { items, loading, error, reload } = usePullRequests({
    includeExternal: "true",
    limit: "100",
  })
  const [search, setSearch] = useState("")
  const [editPr, setEditPr] = useState<PullRequestListItem | null>(null)
  const [deletePr, setDeletePr] = useState<PullRequestListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(null)

  useEffect(() => {
    if (reloadToken > 0) reload()
  }, [reloadToken, reload])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const list = needle
      ? items.filter((pr) => {
          const title = prDisplayTitle(pr).toLowerCase()
          return (
            title.includes(needle) ||
            pr.repo.toLowerCase().includes(needle) ||
            String(pr.number).includes(needle)
          )
        })
      : items

    return [...list].sort((a, b) => {
      const favDiff = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))
      if (favDiff !== 0) return favDiff
      return (b.updatedAt || "").localeCompare(a.updatedAt || "")
    })
  }, [items, search])

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
            <h1 className="text-lg font-semibold text-foreground">{zh.nav.aiReview}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{zh.pageSubtitle.aiReview}</p>
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

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{zh.aiReview.historyTitle}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? zh.common.loading : `${filtered.length} 条记录`}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={zh.aiReview.historySearchPlaceholder}
              className="w-full h-9 pl-8 pr-3 text-sm bg-surface-2 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ai-blue"
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            {zh.common.loading}
          </div>
        )}

        {error && !loading && (
          <p className="py-12 text-sm text-risk-high text-center">{error}</p>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border bg-surface-2/50">
            <GitPullRequest className="w-10 h-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">{zh.aiReview.historyEmpty}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => onImportOpenChange(true)}
            >
              <Plus className="w-4 h-4" />
              {zh.aiReview.importButton}
            </Button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((pr) => (
              <article
                key={pr.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectPr(pr.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSelectPr(pr.id)
                  }
                }}
                className={cn(
                  "group relative flex flex-col rounded-lg border p-4 text-left transition-all cursor-pointer",
                  "hover:border-ai-blue/40 hover:bg-surface-3/80 hover:shadow-[0_0_24px_rgba(56,189,248,0.08)]",
                  riskAccent(pr.riskLevel),
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GitPullRequest className="w-4 h-4 shrink-0 text-ai-blue" />
                    <span className="text-[11px] font-mono text-muted-foreground truncate">
                      {pr.repo} · #{pr.number}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void toggleFavorite(pr)
                    }}
                    disabled={togglingFavoriteId === pr.id}
                    className="shrink-0 text-muted-foreground hover:text-amber-400 disabled:opacity-50"
                    aria-label={pr.favorite ? "取消收藏" : "收藏"}
                  >
                    <Star
                      className={cn(
                        "w-4 h-4",
                        pr.favorite && "fill-amber-400 text-amber-400",
                      )}
                    />
                  </button>
                </div>

                <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug mb-2">
                  {prDisplayTitle(pr)}
                </h3>

                {pr.note ? (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{pr.note}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/60 line-clamp-2 mb-3 italic">
                    {zh.aiReview.cardNoNote}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-border/60">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{formatDate(pr.createdAt ?? pr.updatedAt)}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded border text-[10px]",
                        pr.state === "open"
                          ? "border-risk-low/30 text-risk-low bg-risk-low/10"
                          : "border-border bg-surface-3",
                      )}
                    >
                      {formatPrState(pr.state)}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditPr(pr)}
                      aria-label="编辑"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeletePr(pr)}
                      aria-label="删除"
                      className="text-muted-foreground hover:text-risk-high"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
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
