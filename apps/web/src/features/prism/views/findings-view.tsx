"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react"

import type { FindingCategory, UnifiedFinding } from "@reviewly/shared"

import { FindingDetailDrawer } from "@/features/prism/components/finding-detail-drawer"
import { FindingsKpiStrip } from "@/features/prism/components/findings-kpi-strip"
import { FindingsTable } from "@/features/prism/components/findings-table"
import { RiskCategoryTabs } from "@/features/prism/components/risk-category-tabs"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useReposStore } from "@/features/prism/contexts/repos-context"
import { useFindingsCenter } from "@/hooks/use-findings-center"
import { EMPTY_CATEGORY_COUNTS, RISK_CATEGORY_TABS } from "@/lib/findings-categories"
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
  const [drawerOpen, setDrawerOpen] = useState(false)

  const eligibleRepos = useMemo(
    () => repos.filter((r) => isStatsEligibleRepo(r)),
    [repos],
  )

  const tabCounts = useMemo(() => {
    const c = center.categoryStats?.counts ?? EMPTY_CATEGORY_COUNTS
    const sum =
      c.security + c.performance + c.architecture + c.maintainability + c.convention
    const counts: Record<string, number> = { all: center.categoryFilter === null ? center.total : sum }
    for (const tab of RISK_CATEGORY_TABS) {
      if (tab.id === "all") continue
      counts[tab.id] =
        center.categoryFilter === tab.id ? center.total : (c[tab.id] ?? 0)
    }
    return counts
  }, [center.categoryStats.counts, center.categoryFilter, center.total])

  useEffect(() => {
    if (!urlFindingId) return
    const match = center.items.find((i) => i.id === urlFindingId)
    if (match) {
      setSelected(match)
      center.prepareAi(match)
      setDrawerOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL selection when list loads
  }, [urlFindingId, center.items])

  useEffect(() => {
    if (!selected) return
    const fresh = center.items.find((i) => i.id === selected.id)
    if (fresh && fresh !== selected) {
      setSelected(fresh)
    }
  }, [center.items, selected])

  const handleCategorySelect = (category: FindingCategory | null) => {
    center.setCategoryFilter(category)
    setDrawerOpen(false)
    setSelected(null)
    navigate("findings", {
      tab: category ?? undefined,
      findingId: undefined,
    })
  }

  const handleSelect = (finding: UnifiedFinding) => {
    setSelected(finding)
    center.prepareAi(finding)
    setDrawerOpen(true)
    navigate("findings", {
      tab: finding.findingType,
      findingId: finding.id,
    })
  }

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
    setSelected(null)
    navigate("findings", {
      tab: center.tab === "all" ? undefined : center.tab,
      findingId: undefined,
    })
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <header className="shrink-0 px-4 pt-4 pb-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">{zh.findings.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{zh.pageSubtitle.findings}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => center.reload()}
            disabled={center.loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", center.loading && "animate-spin")} />
            刷新
          </Button>
        </div>

        <FindingsKpiStrip stats={center.stats} loading={center.loading} />

        <RiskCategoryTabs
          activeId={center.categoryFilter}
          tabCounts={tabCounts}
          loading={center.loading}
          onSelect={handleCategorySelect}
        />
      </header>

      <section className="flex flex-col flex-1 min-h-[70vh]">
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-surface-2/40">
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              value={center.searchInput}
              onChange={(e) => center.setSearchInput(e.target.value)}
              placeholder={zh.findings.searchPlaceholder}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-border bg-background"
            />
          </div>
          <select
            value={center.severityFilter}
            onChange={(e) => center.setSeverityFilter(e.target.value)}
            className="h-8 text-xs rounded-md border border-border bg-background px-2"
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
            className="h-8 text-xs rounded-md border border-border bg-background px-2 max-w-[180px]"
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
            className="h-8 text-xs rounded-md border border-border bg-background px-2"
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

        {center.error && (
          <p className="shrink-0 px-4 py-2 text-xs text-risk-high border-b border-border">{center.error}</p>
        )}

        <FindingsTable
          items={center.items}
          loading={center.loading}
          selectedId={selected?.id ?? null}
          sort={center.sort}
          onSortChange={center.setSort}
          onSelect={handleSelect}
        />

        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground bg-surface-2/30">
          <span className="tabular-nums">
            共 {center.total} 条 · 第 {center.page} / {center.totalPages} 页
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={center.page <= 1}
              onClick={() => center.setPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded hover:bg-accent disabled:opacity-40"
              aria-label="上一页"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={center.page >= center.totalPages}
              onClick={() => center.setPage((p) => p + 1)}
              className="p-1 rounded hover:bg-accent disabled:opacity-40"
              aria-label="下一页"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </section>

      <Sheet open={drawerOpen && !!selected} onOpenChange={(open) => !open && handleCloseDrawer()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] p-0 gap-0 border-border [&>button]:hidden"
        >
          <SheetTitle className="sr-only">{zh.findings.detailTitle}</SheetTitle>
          {selected && (
            <FindingDetailDrawer
              finding={selected}
              aiText={center.aiText}
              aiLoading={center.aiFindingId === selected.id}
              aiError={center.aiError}
              actionLoading={center.actionLoading}
              onRunAi={(f) => void center.runAi(f)}
              onReopen={async (f) => {
                const updated = await center.updateStatus(f, "open")
                if (updated) setSelected(updated)
              }}
              onResolve={async (f) => {
                const updated = await center.updateStatus(f, "resolved")
                if (updated) {
                  setSelected(updated)
                  handleCloseDrawer()
                }
              }}
              onSaveNote={async (f, note) => {
                const updated = await center.saveNote(f, note)
                if (updated) setSelected(updated)
              }}
              onOpenPr={(f) => {
                if (f.pullRequestId) {
                  navigate("ai-review", { prId: f.pullRequestId })
                }
              }}
              onClose={handleCloseDrawer}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
