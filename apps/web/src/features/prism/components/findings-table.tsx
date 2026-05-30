"use client"

import { motion } from "framer-motion"
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react"

import type { UnifiedFinding } from "@reviewly/shared"

import { severityConfig } from "@/features/prism/components/security-findings-table"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"

interface FindingsTableProps {
  items: UnifiedFinding[]
  loading: boolean
  selectedId: string | null
  sort: "createdAt" | "severity"
  onSortChange: (sort: "createdAt" | "severity") => void
  onSelect: (finding: UnifiedFinding) => void
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: "asc" | "desc"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      {active ? (
        direction === "desc" ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUp className="size-3" />
        )
      ) : null}
    </button>
  )
}

export function FindingsTable({
  items,
  loading,
  selectedId,
  sort,
  onSortChange,
  onSelect,
}: FindingsTableProps) {
  if (loading) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">{zh.common.loading}</p>
  }

  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">{zh.findings.empty}</p>
  }

  const toggleSort = (key: "createdAt" | "severity") => {
    if (sort === key) return
    onSortChange(key)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-2 border-b border-border text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">{zh.findings.riskType}</th>
            <th className="px-4 py-2 font-medium">
              <SortHeader
                label={zh.common.severity}
                active={sort === "severity"}
                direction="asc"
                onClick={() => toggleSort("severity")}
              />
            </th>
            <th className="px-4 py-2 font-medium">{zh.findings.ruleName}</th>
            <th className="px-4 py-2 font-medium">{zh.common.repoPr}</th>
            <th className="px-4 py-2 font-medium">{zh.common.location}</th>
            <th className="px-4 py-2 font-medium">
              <SortHeader
                label={zh.findings.discoveredAt}
                active={sort === "createdAt"}
                direction="desc"
                onClick={() => toggleSort("createdAt")}
              />
            </th>
            <th className="px-4 py-2 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((row, idx) => {
            const sev = severityConfig[row.severity] ?? severityConfig.low
            const selected = selectedId === row.id
            return (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => onSelect(row)}
                className={cn(
                  "cursor-pointer hover:bg-surface-2/60",
                  selected && "bg-ai-blue/5 ring-1 ring-inset ring-ai-blue/20",
                )}
              >
                <td className="px-4 py-3 text-muted-foreground">{row.typeLabel}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
                      sev.bg,
                      sev.color,
                    )}
                  >
                    {sev.label}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-foreground max-w-[140px] truncate">
                  {row.rule}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.repo}
                  <span className="text-ai-blue">#{row.prNumber}</span>
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground max-w-[180px] truncate">
                  {row.file}
                  {row.line ? `:${row.line}` : ""}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {row.discoveredAt
                    ? new Date(row.discoveredAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
