"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Shield,
  AlertTriangle,
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import type { SecurityCenterFinding } from "@reviewly/shared"

import { SecurityExplainPanel } from "@/features/prism/components/security-explain-panel"
import {
  SecurityFindingsTable,
  severityConfig,
} from "@/features/prism/components/security-findings-table"
import { useNavigation } from "@/features/prism/contexts/navigation-context"
import { useRepos } from "@/hooks/use-repos"
import { useSecurityCenter } from "@/hooks/use-security-center"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

const SEVERITY_OPTIONS = ["", "critical", "high", "medium", "low"] as const

export function SecurityView() {
  const { navigate } = useNavigation()
  const { repos } = useRepos()
  const {
    items,
    total,
    page,
    totalPages,
    setPage,
    stats,
    loading,
    error,
    severityFilter,
    setSeverityFilter,
    repoFilter,
    setRepoFilter,
    searchInput,
    setSearchInput,
    filtersOpen,
    setFiltersOpen,
    explainingId,
    explainText,
    explainError,
    prepareExplain,
    explainFinding,
    cancelExplain,
  } = useSecurityCenter()

  const [explainOpen, setExplainOpen] = useState(false)
  const [activeFinding, setActiveFinding] = useState<SecurityCenterFinding | null>(null)

  const securityMetrics = useMemo(
    () => [
      {
        label: "安全评分",
        value: stats ? String(Math.max(0, 100 - stats.critical * 15)) : "—",
        suffix: "/100",
      },
      { label: "开放漏洞", value: stats ? String(stats.openFindings) : "—", suffix: "" },
      { label: "严重", value: stats ? String(stats.critical) : "—", suffix: "" },
      { label: "高危", value: stats ? String(stats.high) : "—", suffix: "" },
    ],
    [stats],
  )

  const openExplain = (finding: SecurityCenterFinding) => {
    setActiveFinding(finding)
    prepareExplain(finding)
    setExplainOpen(true)
  }

  const goToPr = (finding: SecurityCenterFinding) => {
    if (finding.pullRequestId) {
      navigate("ai-review", { prId: finding.pullRequestId })
    }
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">安全中心</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{zh.security.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索规则、文件、描述…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-52 h-8 pl-8 pr-3 text-xs bg-surface-2 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ai-blue"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-surface-2 rounded-md hover:bg-surface-3"
          >
            {filtersOpen ? zh.common.collapseFilters : zh.common.filter}
          </button>
          <button
            type="button"
            onClick={() => navigate("pull-requests")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ai-blue rounded-md hover:opacity-90"
          >
            <Shield className="w-3.5 h-3.5" />
            {zh.actions.goToPrList}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{zh.common.severity}</span>
          {SEVERITY_OPTIONS.map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setSeverityFilter(s)}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-medium border",
                severityFilter === s
                  ? "border-ai-blue text-ai-blue bg-[oklch(0.62_0.19_240/0.1)]"
                  : "border-border text-muted-foreground hover:bg-surface-2",
              )}
            >
              {s ? severityConfig[s as keyof typeof severityConfig]?.label ?? s : zh.common.all}
            </button>
          ))}
          <select
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            className="ml-2 h-7 text-xs bg-surface-2 border border-border rounded-md px-2 text-foreground"
          >
            <option value="">{zh.common.allRepos}</option>
            {repos.map((r) => (
              <option key={r.id} value={r.fullName}>
                {r.fullName}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-risk-high">{error}</p>}

      <div className="grid grid-cols-4 gap-3">
        {securityMetrics.map((metric) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-surface-2 border border-border"
          >
            <div className="text-xs text-muted-foreground">{metric.label}</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-semibold text-foreground">{metric.value}</span>
              <span className="text-sm text-muted-foreground">{metric.suffix}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-risk-high" />
            <span className="text-sm font-medium text-foreground">漏洞列表</span>
            <span className="text-xs text-muted-foreground">{zh.common.recordsCount(total, loading)}</span>
          </div>
          {stats && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[oklch(0.55_0.22_27)]" />
                严重 {stats.critical}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-risk-high" />
                高危 {stats.high}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-risk-medium" />
                中危 {stats.medium}
              </span>
            </div>
          )}
        </div>

        <SecurityFindingsTable
          items={items}
          loading={loading}
          explainingId={explainingId}
          onRowClick={goToPr}
          onExplainClick={openExplain}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-2">
            <span className="text-xs text-muted-foreground">{zh.common.pageOf(page, totalPages)}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded hover:bg-surface-3 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded hover:bg-surface-3 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-ai-blue" />
          <span className="text-sm font-medium text-foreground">{zh.common.explain}</span>
        </div>
        <p className="text-xs text-muted-foreground">{zh.security.findingsNote}</p>
      </div>

      <SecurityExplainPanel
        finding={activeFinding}
        open={explainOpen}
        onOpenChange={setExplainOpen}
        explainText={explainText}
        explainError={explainError}
        explaining={Boolean(explainingId && activeFinding?.id === explainingId)}
        onExplain={() => activeFinding && void explainFinding(activeFinding.id)}
        onCancel={cancelExplain}
      />
    </div>
  )
}
