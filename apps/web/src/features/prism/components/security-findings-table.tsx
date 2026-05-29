"use client"

import { motion } from "framer-motion"
import { ChevronRight, Sparkles } from "lucide-react"

import type { SecurityCenterFinding } from "@reviewly/shared"

import { cn } from "@/lib/utils"

export const severityConfig = {
  critical: { color: "text-[oklch(0.55_0.22_27)]", bg: "bg-[oklch(0.55_0.22_27/0.1)]", label: "严重" },
  high: { color: "text-risk-high", bg: "bg-[oklch(0.62_0.21_32/0.1)]", label: "高危" },
  medium: { color: "text-risk-medium", bg: "bg-[oklch(0.75_0.15_85/0.1)]", label: "中危" },
  low: { color: "text-muted-foreground", bg: "bg-surface-3", label: "低危" },
} as const

interface SecurityFindingsTableProps {
  items: SecurityCenterFinding[]
  loading: boolean
  explainingId: string | null
  onRowClick: (finding: SecurityCenterFinding) => void
  onExplainClick: (finding: SecurityCenterFinding) => void
}

export function SecurityFindingsTable({
  items,
  loading,
  explainingId,
  onRowClick,
  onExplainClick,
}: SecurityFindingsTableProps) {
  if (loading) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">加载中…</p>
  }

  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">暂无匹配的安全发现。</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-2 border-b border-border text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">规则</th>
            <th className="px-4 py-2 font-medium">严重度</th>
            <th className="px-4 py-2 font-medium">仓库 / PR</th>
            <th className="px-4 py-2 font-medium">位置</th>
            <th className="px-4 py-2 font-medium">描述</th>
            <th className="px-4 py-2 font-medium w-28">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((row, idx) => {
            const sev = severityConfig[row.severity]
            return (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="hover:bg-surface-2/50 group"
              >
                <td className="px-4 py-3 font-medium text-foreground">{row.rule}</td>
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
                <td className="px-4 py-3 text-muted-foreground">
                  <button
                    type="button"
                    className="hover:text-foreground text-left"
                    onClick={() => onRowClick(row)}
                  >
                    {row.repo}
                    <span className="text-ai-blue">#{row.prNumber}</span>
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {row.file}:{row.line}
                </td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={row.description}>
                  {row.description}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onExplainClick(row)
                      }}
                      disabled={explainingId === row.id}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-surface-3 text-ai-blue hover:bg-surface-2 disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3" />
                      AI Explain
                    </button>
                    <button
                      type="button"
                      onClick={() => onRowClick(row)}
                      className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground"
                      aria-label="打开 PR 评审"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
