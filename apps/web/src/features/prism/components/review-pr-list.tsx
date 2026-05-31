"use client"

import type { ReactNode } from "react"
import { AlertTriangle, GitPullRequest, Pencil, Star, Trash2 } from "lucide-react"
import type { PullRequestListItem, ReviewStatus } from "@reviewly/shared"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RepositoryBadges } from "@/features/prism/components/repository-badges"
import {
  REVIEW_STATUS_LABELS,
  reviewStatusBadgeClass,
} from "@/features/prism/lib/review-status-utils"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

function formatPrState(state: PullRequestListItem["state"]) {
  if (state === "open") return "开放"
  if (state === "merged") return "已合并"
  return "已关闭"
}

function formatRelativeAge(iso?: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${Math.max(1, mins)}m`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
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

function riskStripeClass(level: PullRequestListItem["riskLevel"]) {
  if (level === "critical" || level === "high") return "bg-risk-high"
  if (level === "medium") return "bg-amber-400"
  return "bg-border"
}

function statusDotClass(status?: ReviewStatus) {
  switch (status) {
    case "OPEN":
      return "bg-ai-blue"
    case "IN_REVIEW":
      return "bg-amber-400"
    case "CHANGES_REQUESTED":
      return "bg-risk-medium"
    case "APPROVED":
    case "MERGED":
      return "bg-risk-low"
    case "CLOSED":
      return "bg-muted-foreground"
    default:
      return "bg-border"
  }
}

function riskPillClass(level: PullRequestListItem["riskLevel"]) {
  if (level === "critical" || level === "high") {
    return "border-risk-high/40 text-risk-high bg-risk-high/10"
  }
  if (level === "medium") {
    return "border-amber-400/40 text-amber-300 bg-amber-400/10"
  }
  return "border-border text-muted-foreground bg-surface-3"
}

export interface ReviewPrListProps {
  items: PullRequestListItem[]
  loading?: boolean
  error?: string | null
  compact?: boolean
  variant?: "default" | "linear"
  showActions?: boolean
  showQuickActions?: boolean
  togglingFavoriteId?: string | null
  onSelect: (prId: string) => void
  onFavorite?: (pr: PullRequestListItem) => void
  onEdit?: (pr: PullRequestListItem) => void
  onDelete?: (pr: PullRequestListItem) => void
  onApprove?: (pr: PullRequestListItem) => void
  onDismiss?: (pr: PullRequestListItem) => void
  emptyMessage?: string
  emptyAction?: ReactNode
}

function LinearPrRow({
  pr,
  rowPy,
  showQuickActions,
  showActions,
  togglingFavoriteId,
  onSelect,
  onFavorite,
  onEdit,
  onDelete,
  onApprove,
  onDismiss,
}: {
  pr: PullRequestListItem
  rowPy: string
  showQuickActions: boolean
  showActions: boolean
  togglingFavoriteId: string | null
  onSelect: (prId: string) => void
  onFavorite?: (pr: PullRequestListItem) => void
  onEdit?: (pr: PullRequestListItem) => void
  onDelete?: (pr: PullRequestListItem) => void
  onApprove?: (pr: PullRequestListItem) => void
  onDismiss?: (pr: PullRequestListItem) => void
}) {
  const hasAi = Boolean(pr.aiSummary?.content || pr.aiSummary?.usage?.totalTokens)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(pr.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(pr.id)
        }
      }}
      className={cn(
        "group flex items-center gap-2 px-2 sm:px-3 cursor-pointer transition-colors",
        rowPy,
        "hover:bg-surface-2/80",
      )}
    >
      <span
        className={cn("w-2 h-2 rounded-full shrink-0", statusDotClass(pr.reviewStatus))}
        aria-hidden
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{prDisplayTitle(pr)}</p>
          {hasAi ? (
            <span
              className="w-1.5 h-1.5 rounded-full bg-ai-purple/70 shrink-0"
              title="已有 AI 分析"
              aria-hidden
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
          <span className="font-mono truncate max-w-[14rem]">
            {pr.repo} · #{pr.number}
          </span>
          {pr.reviewStatus ? (
            <span
              className={cn(
                "shrink-0 text-[9px] px-1.5 py-0.5 rounded border font-medium",
                reviewStatusBadgeClass(pr.reviewStatus),
              )}
            >
              {REVIEW_STATUS_LABELS[pr.reviewStatus]}
            </span>
          ) : null}
          <span
            className={cn(
              "shrink-0 px-1 py-0.5 rounded border text-[9px]",
              pr.state === "open" ? "border-risk-low/30 text-risk-low" : "border-border",
            )}
          >
            {formatPrState(pr.state)}
          </span>
          <span
            className={cn(
              "shrink-0 text-[9px] px-1 py-0.5 rounded border font-medium uppercase",
              riskPillClass(pr.riskLevel),
            )}
          >
            {pr.riskLevel}
          </span>
          <span className="text-[10px] font-mono tabular-nums shrink-0">
            {formatRelativeAge(pr.updatedAt ?? pr.createdAt)}
          </span>
        </div>
      </div>

      {showQuickActions ? (
        <div
          className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => onSelect(pr.id)}
          >
            Open
          </Button>
          {onApprove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-risk-low"
              onClick={() => onApprove(pr)}
            >
              Approve
            </Button>
          ) : null}
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-muted-foreground"
              onClick={() => onDismiss(pr)}
            >
              Dismiss
            </Button>
          ) : null}
        </div>
      ) : null}

      {showActions && !showQuickActions ? (
        <div
          className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {onFavorite ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={togglingFavoriteId === pr.id}
              onClick={() => onFavorite(pr)}
              aria-label={pr.favorite ? "取消收藏" : "收藏"}
              className="h-7 w-7"
            >
              <Star
                className={cn("w-3.5 h-3.5", pr.favorite && "fill-amber-400 text-amber-400")}
              />
            </Button>
          ) : null}
          {onEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(pr)}
              aria-label="编辑"
              className="h-7 w-7"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(pr)}
              aria-label="删除"
              className="h-7 w-7 text-muted-foreground hover:text-risk-high"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function DefaultPrRow({
  pr,
  rowPy,
  showActions,
  togglingFavoriteId,
  onSelect,
  onFavorite,
  onEdit,
  onDelete,
}: {
  pr: PullRequestListItem
  rowPy: string
  showActions: boolean
  togglingFavoriteId: string | null
  onSelect: (prId: string) => void
  onFavorite?: (pr: PullRequestListItem) => void
  onEdit?: (pr: PullRequestListItem) => void
  onDelete?: (pr: PullRequestListItem) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(pr.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(pr.id)
        }
      }}
      className={cn(
        "group flex items-center gap-2 sm:gap-3 px-2 sm:px-3 cursor-pointer transition-colors",
        rowPy,
        "hover:bg-surface-2/80",
      )}
    >
      <div
        className={cn(
          "w-0.5 self-stretch min-h-[2rem] shrink-0 rounded-full",
          riskStripeClass(pr.riskLevel),
        )}
        aria-hidden
      />

      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
        <p className="text-sm font-medium text-foreground truncate min-w-0">
          {prDisplayTitle(pr)}
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground min-w-0">
          <span className="font-mono truncate max-w-[12rem]">
            {pr.repo} · #{pr.number}
          </span>
          {pr.reviewStatus ? (
            <span
              className={cn(
                "shrink-0 text-[9px] px-1.5 py-0.5 rounded border font-medium",
                reviewStatusBadgeClass(pr.reviewStatus),
              )}
            >
              {REVIEW_STATUS_LABELS[pr.reviewStatus]}
            </span>
          ) : null}
          <span
            className={cn(
              "shrink-0 px-1 py-0.5 rounded border text-[9px]",
              pr.state === "open" ? "border-risk-low/30 text-risk-low" : "border-border",
            )}
          >
            {formatPrState(pr.state)}
          </span>
          <RepositoryBadges
            sourceType={pr.sourceType}
            isManaged={pr.isManaged}
            managed={pr.managed}
            repositoryType={pr.repositoryType}
            className="hidden sm:inline-flex"
          />
          {(pr.riskLevel === "critical" || pr.riskLevel === "high") && (
            <AlertTriangle className="w-3 h-3 text-risk-high shrink-0 sm:hidden" aria-hidden />
          )}
        </div>
      </div>

      <span className="hidden md:inline text-[11px] text-muted-foreground font-mono shrink-0 tabular-nums">
        {formatDate(pr.updatedAt ?? pr.createdAt)}
      </span>

      {showActions ? (
        <div
          className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {onFavorite ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={togglingFavoriteId === pr.id}
              onClick={() => onFavorite(pr)}
              aria-label={pr.favorite ? "取消收藏" : "收藏"}
              className="h-7 w-7"
            >
              <Star
                className={cn("w-3.5 h-3.5", pr.favorite && "fill-amber-400 text-amber-400")}
              />
            </Button>
          ) : null}
          {onEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(pr)}
              aria-label="编辑"
              className="h-7 w-7"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(pr)}
              aria-label="删除"
              className="h-7 w-7 text-muted-foreground hover:text-risk-high"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function ReviewPrList({
  items,
  loading = false,
  error = null,
  compact = false,
  variant = "default",
  showActions = true,
  showQuickActions = false,
  togglingFavoriteId = null,
  onSelect,
  onFavorite,
  onEdit,
  onDelete,
  onApprove,
  onDismiss,
  emptyMessage,
  emptyAction,
}: ReviewPrListProps) {
  const rowPy = compact ? "py-2" : "py-2.5"
  const isLinear = variant === "linear"

  if (loading) {
    return (
      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
        {Array.from({ length: compact ? 6 : 8 }).map((_, i) => (
          <div key={i} className={cn("flex items-center gap-3 px-3", rowPy)}>
            <Skeleton className="w-2 h-2 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="py-6 text-center text-sm text-risk-high border border-border rounded-lg">
        {error}
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-4 text-sm text-muted-foreground border border-dashed border-border rounded-lg bg-surface-2/30">
        <span className="flex items-center gap-2 min-w-0">
          <GitPullRequest className="w-4 h-4 shrink-0 opacity-50" />
          <span className="truncate">{emptyMessage ?? zh.aiReview.historyEmpty}</span>
        </span>
        {emptyAction}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="divide-y divide-border">
        {items.map((pr) =>
          isLinear ? (
            <LinearPrRow
              key={pr.id}
              pr={pr}
              rowPy={rowPy}
              showQuickActions={showQuickActions}
              showActions={showActions}
              togglingFavoriteId={togglingFavoriteId}
              onSelect={onSelect}
              onFavorite={onFavorite}
              onEdit={onEdit}
              onDelete={onDelete}
              onApprove={onApprove}
              onDismiss={onDismiss}
            />
          ) : (
            <DefaultPrRow
              key={pr.id}
              pr={pr}
              rowPy={rowPy}
              showActions={showActions}
              togglingFavoriteId={togglingFavoriteId}
              onSelect={onSelect}
              onFavorite={onFavorite}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ),
        )}
      </div>
    </div>
  )
}

export function ReviewPrListSection({
  title,
  items,
  ...listProps
}: ReviewPrListProps & { title: string }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
        {title}
      </h3>
      <ReviewPrList items={items} {...listProps} />
    </div>
  )
}
