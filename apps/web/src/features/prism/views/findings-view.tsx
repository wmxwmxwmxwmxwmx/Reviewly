"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react"

import type { FindingCategory, UnifiedFinding } from "@reviewly/shared"

import { FindingDetailDrawer } from "@/features/prism/components/finding-detail-drawer"
import { FindingsKpiStrip } from "@/features/prism/components/findings-kpi-strip"
import { FindingsTable } from "@/features/prism/components/findings-table"
import { RiskCategoryCards } from "@/features/prism/components/risk-category-cards"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { useFindingsCenter } from "@/hooks/use-findings-center"
import { isStatsEligibleRepo } from "@/lib/repos-utils"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

const SEVERITY_OPTIONS = ["", "critical", "high", "medium", "low"] as const
const STATUS_OPTIONS = ["", "open", "ignored", "resolved"] as const

export function FindingsView() {
  const { navigate, findingsTab, findingId: urlFindingId } = useNavigation()
  const { repos } = useReposStore()
  const center = useFindingsCenter(findingsTab)
  const [selected, setSelected] = useState<UnifiedFinding | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const eligibleRepos = useMemo(
    () => repos.filter((r) => isStatsEligibleRepo(r)),
    [repos],
  )

  useEffect(() => {
    if (!urlFindingId || !center.items.length) return
    const match = center.items.find((i) => i.id === urlFindingId)
    if (match) {
      setSelected(match)
      center.prepareAi(match)
      setSheetOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync selection when list loads
  }, [urlFindingId, center.items])

  const handleCategorySelect = (category: FindingCategory | null) => {
    center.setCategoryFilter(category)
    setSelected(null)
    setSheetOpen(false)
    navigate("findings", {
      tab: category ?? undefined,
      findingId: undefined,
    })
  }

  const handleSelect = (finding: UnifiedFinding) => {
    setSelected(finding)
    center.prepareAi(finding)
    setSheetOpen(true)
    navigate("findings", {
      tab: finding.findingType,
      findingId: finding.id,
    })
  }

  const handleCloseDetail = () => {
    setSelected(null)
    setSheetOpen(false)
    navigate("findings", {
      tab: center.tab === "all" ? undefined : center.tab,
      findingId: undefined,
    })
  }

  const detailPanel = (
    <FindingDetailDrawer
      finding={selected}
      aiText={center.aiText}
      aiLoading={center.aiFindingId === selected?.id}
      aiError={center.aiError}
      actionLoading={center.actionLoading}
      onClose={handleCloseDetail}
      onRunAi={(f) => void center.runAi(f)}
      onReanalyze={(f) => void center.reanalyze(f)}
      onIgnore={async (f) => {
        const ok = await center.updateStatus(f, "ignored")
        if (ok) handleCloseDetail()
      }}
      onResolve={async (f) => {
        const ok = await center.updateStatus(f, "resolved")
        if (ok) handleCloseDetail()
      }}
      onOpenPr={(f) => {
        if (f.pullRequestId) {
          navigate("ai-review", { prId: f.pullRequestId })
        }
      }}
    />
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-5 space-y-4 shrink-0 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-risk-high" />
              {zh.findings.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{zh.pageSubtitle.findings}</p>
          </div>
          <button
            type="button"
            onClick={() => center.reload()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", center.loading && "animate-spin")} />
            刷新
          </button>
        </div>

        <FindingsKpiStrip stats={center.stats} loading={center.loading} />

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">{zh.findings.categoryOverview}</p>
          <RiskCategoryCards
            categoryStats={center.categoryStats}
            activeId={center.categoryFilter}
            loading={center.loading}
            onSelect={handleCategorySelect}
          />
        </div>

        {center.filtersOpen && (
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={center.searchInput}
                onChange={(e) => center.setSearchInput(e.target.value)}
                placeholder={zh.findings.searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-surface-2"
              />
            </div>
            <select
              value={center.severityFilter}
              onChange={(e) => center.setSeverityFilter(e.target.value)}
              className="text-xs rounded-md border border-border bg-surface-2 px-2 py-1.5"
            >
              <option value="">全部等级</option>
              {SEVERITY_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {zh.severity[s as keyof typeof zh.severity]}
                </option>
              ))}
            </select>
            <select
              value={center.repoFilter}
              onChange={(e) => center.setRepoFilter(e.target.value)}
              className="text-xs rounded-md border border-border bg-surface-2 px-2 py-1.5 max-w-[200px]"
            >
              <option value="">全部仓库</option>
              {eligibleRepos.map((r) => (
                <option key={r.id} value={r.fullName}>
                  {r.fullName}
                </option>
              ))}
            </select>
            <select
              value={center.statusFilter}
              onChange={(e) => center.setStatusFilter(e.target.value)}
              className="text-xs rounded-md border border-border bg-surface-2 px-2 py-1.5"
            >
              <option value="">全部状态</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s === "open"
                    ? zh.findings.statusOpen
                    : s === "ignored"
                      ? zh.findings.statusIgnored
                      : zh.findings.statusResolved}
                </option>
              ))}
            </select>
          </div>
        )}

        {center.error && (
          <p className="text-sm text-risk-high">{center.error}</p>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <FindingsTable
            items={center.items}
            loading={center.loading}
            selectedId={selected?.id ?? null}
            sort={center.sort}
            onSortChange={center.setSort}
            onSelect={handleSelect}
          />
          <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground">
            <span>
              共 {center.total} 条 · 第 {center.page} / {center.totalPages} 页
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={center.page <= 1}
                onClick={() => center.setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={center.page >= center.totalPages}
                onClick={() => center.setPage((p) => p + 1)}
                className="p-1 rounded hover:bg-accent disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="w-[min(420px,38vw)] shrink-0 hidden lg:block">{detailPanel}</div>
      </div>

      <Sheet open={sheetOpen && !!selected} onOpenChange={(open) => !open && handleCloseDetail()}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{zh.findings.detailTitle}</SheetTitle>
          </SheetHeader>
          <div className="h-full">{detailPanel}</div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
