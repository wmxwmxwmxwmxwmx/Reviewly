"use client"

import { ArrowDown, ArrowUp } from "lucide-react"

import type { UnifiedFinding } from "@reviewly/shared"

import {
  FINDINGS_SEVERITY_COLORS,
  FINDINGS_SEVERITY_LABELS,
  statusLabel,
} from "@/lib/findings-severity-display"
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
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors font-medium"
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

function SeverityBadge({ severity }: { severity: UnifiedFinding["severity"] }) {
  const color = FINDINGS_SEVERITY_COLORS[severity]
  const label = FINDINGS_SEVERITY_LABELS[severity]
  return (
    <span
      className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{
        color,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}40`,
      }}
    >
      {label}
    </span>
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
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        {zh.common.loading}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        {zh.findings.empty}
      </div>
    )
  }

  const toggleSort = (key: "createdAt" | "severity") => {
    if (sort === key) return
    onSortChange(key)
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-2 border-b border-border text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 w-[72px]">
              <SortHeader
                label="等级"
                active={sort === "severity"}
                direction="asc"
                onClick={() => toggleSort("severity")}
              />
            </th>
            <th className="px-3 py-2.5 font-medium w-[88px]">类型</th>
            <th className="px-3 py-2.5 font-medium min-w-[120px]">规则</th>
            <th className="px-3 py-2.5 font-medium min-w-[100px]">仓库</th>
            <th className="px-3 py-2.5 font-medium min-w-[140px]">文件</th>
            <th className="px-3 py-2.5 font-medium w-[72px]">状态</th>
            <th className="px-3 py-2.5 font-medium w-[100px] whitespace-nowrap">
              <SortHeader
                label="发现时间"
                active={sort === "createdAt"}
                direction="desc"
                onClick={() => toggleSort("createdAt")}
              />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/80">
          {items.map((row) => {
            const selected = selectedId === row.id
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={cn(
                  "cursor-pointer transition-colors",
                  selected ? "bg-ai-blue/8" : "hover:bg-surface-2/50",
                )}
              >
                <td className="px-3 py-2.5">
                  <SeverityBadge severity={row.severity} />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.typeLabel}</td>
                <td className="px-3 py-2.5 font-medium text-foreground max-w-[200px] truncate">
                  {row.rule}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground font-mono text-[11px] truncate max-w-[140px]">
                  {row.repo}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground max-w-[200px] truncate">
                  {row.file}
                  {row.line ? `:${row.line}` : ""}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{statusLabel(row.status)}</td>
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap tabular-nums">
                  {row.discoveredAt
                    ? new Date(row.discoveredAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
