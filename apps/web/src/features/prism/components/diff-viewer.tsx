"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertOctagon,
  FileCode,
  User,
  Loader2,
} from "lucide-react"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import type { DiffFile, DiffLine } from "@reviewly/shared"

const riskConfig = {
  critical: { label: zh.riskFile.critical, color: "text-risk-critical", bg: "bg-[oklch(0.55_0.22_27/0.08)]", border: "border-[oklch(0.55_0.22_27/0.25)]", dot: "bg-risk-critical" },
  high: { label: zh.riskFile.high, color: "text-risk-high", bg: "bg-[oklch(0.65_0.18_46/0.08)]", border: "border-[oklch(0.65_0.18_46/0.25)]", dot: "bg-risk-high" },
  medium: { label: zh.riskFile.medium, color: "text-risk-medium", bg: "bg-[oklch(0.75_0.16_83/0.08)]", border: "border-[oklch(0.75_0.16_83/0.25)]", dot: "bg-risk-medium" },
  low: { label: zh.riskFile.low, color: "text-risk-low", bg: "bg-[oklch(0.62_0.17_148/0.08)]", border: "border-[oklch(0.62_0.17_148/0.25)]", dot: "bg-risk-low" },
  none: { label: zh.riskFile.none, color: "text-muted-foreground", bg: "", border: "border-transparent", dot: "bg-muted" },
}

const langIcon: Record<string, string> = {
  go: "Go",
  yaml: "YML",
  ts: "TS",
  tsx: "TSX",
  js: "JS",
  py: "PY",
}

/** 与 DiffLineRow 行号列 + 前缀列宽度一致，保证 AI 提示与代码行对齐 */
function DiffLineGutter() {
  return (
    <div className="flex shrink-0" aria-hidden>
      <span className="w-10 border-r border-border/50" />
      <span className="w-10 border-r border-border/50" />
      <span className="w-5" />
    </div>
  )
}

function riskCommentBorderClass(lineType: DiffLine["type"]) {
  if (lineType === "add") return "border-l-[oklch(0.62_0.17_148/0.4)]"
  if (lineType === "delete") return "border-l-[oklch(0.55_0.22_27/0.4)]"
  return "border-l-border"
}

function RiskComment({
  comment,
  lineType,
}: {
  comment: NonNullable<DiffLine["riskComment"]>
  lineType: DiffLine["type"]
}) {
  const cfg =
    comment.severity === "critical"
      ? riskConfig.critical
      : comment.severity === "high"
        ? riskConfig.high
        : riskConfig.medium
  return (
    <motion.div
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-stretch font-mono text-[11px] border-b border-border/50"
    >
      <DiffLineGutter />
      <div
        className={cn(
          "flex flex-1 items-start gap-2.5 border-l-2 py-2 pr-4 pl-3 min-w-0",
          riskCommentBorderClass(lineType),
          cfg.bg,
          cfg.border,
        )}
      >
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {comment.severity === "critical" ? (
            <AlertOctagon className={cn("w-3.5 h-3.5", cfg.color)} />
          ) : (
            <AlertTriangle className={cn("w-3.5 h-3.5", cfg.color)} />
          )}
          <span className={cn("font-semibold uppercase text-[9px] tracking-wider", cfg.color)}>
            AI {comment.severity === "critical" ? "严重" : "警告"}
          </span>
        </div>
        <p className="text-muted-foreground leading-relaxed flex-1">{comment.message}</p>
      </div>
    </motion.div>
  )
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const [showComment, setShowComment] = useState(!!line.riskComment)

  const bgClass = line.type === "add"
    ? "bg-[oklch(0.62_0.17_148/0.06)]"
    : line.type === "delete"
    ? "bg-[oklch(0.55_0.22_27/0.06)]"
    : ""

  const borderClass = line.type === "add"
    ? "border-l-2 border-l-[oklch(0.62_0.17_148/0.4)]"
    : line.type === "delete"
    ? "border-l-2 border-l-[oklch(0.55_0.22_27/0.4)]"
    : "border-l-2 border-l-transparent"

  const prefix = line.type === "add" ? "+" : line.type === "delete" ? "-" : " "
  const prefixColor = line.type === "add" ? "text-risk-low" : line.type === "delete" ? "text-risk-critical" : "text-muted-foreground"

  const hasRisk = !!line.riskComment

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div
        className={cn(
          "group flex items-start font-mono text-[11px] hover:bg-accent/30 transition-colors",
          hasRisk && "cursor-pointer",
          bgClass,
          borderClass,
          hasRisk && "ring-1 ring-inset ring-[oklch(0.55_0.22_27/0.15)]",
        )}
        onClick={() => hasRisk && setShowComment(!showComment)}
      >
        {/* Line Numbers */}
        <div className="flex shrink-0">
          <span className="w-10 text-right pr-2 py-0.5 text-muted-foreground/40 select-none border-r border-border text-[10px]">
            {line.oldNum ?? ""}
          </span>
          <span className="w-10 text-right pr-2 py-0.5 text-muted-foreground/40 select-none border-r border-border text-[10px]">
            {line.newNum ?? ""}
          </span>
        </div>

        {/* Prefix */}
        <span className={cn("w-5 text-center py-0.5 shrink-0 select-none", prefixColor)}>
          {prefix}
        </span>

        {/* Code */}
        <span className={cn("flex-1 py-0.5 pr-4 whitespace-pre-wrap break-all", line.type === "context" ? "text-muted-foreground" : "text-foreground")}>
          {line.content}
        </span>

        {/* Risk Icon */}
        {hasRisk && (
          <div className="py-0.5 pr-2 shrink-0">
            <AlertOctagon className="w-3 h-3 text-risk-critical" />
          </div>
        )}
      </div>
      {hasRisk && showComment && line.riskComment && (
        <RiskComment comment={line.riskComment} lineType={line.type} />
      )}
    </div>
  )
}

interface DiffFileCardProps {
  file: DiffFile
  index: number
}

function DiffFileCard({ file, index }: DiffFileCardProps) {
  const [collapsed, setCollapsed] = useState(file.collapsed)
  const cfg = riskConfig[file.riskLevel]
  const ext = file.path.split('.').pop() || 'txt'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="rounded-lg border border-border overflow-hidden isolate"
    >
      {/* File Header */}
      <button
        type="button"
        className="relative z-10 w-full flex items-center gap-3 px-4 py-2.5 bg-[oklch(0.155_0.005_264)] border-b border-border hover:bg-surface-3 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-0.5 shrink-0">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>

        {/* File type badge */}
        <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-surface-4 text-muted-foreground shrink-0">
          {langIcon[file.language] || ext.toUpperCase()}
        </span>

        {/* Path */}
        <span className="flex-1 text-xs font-mono text-foreground text-left truncate">{file.path}</span>

        {/* Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-risk-low font-mono">+{file.additions}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-risk-critical font-mono">-{file.deletions}</span>
          </div>

          {/* Ownership */}
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
            <User className="w-3 h-3" />
            <span>{file.owner}</span>
          </div>

          {/* Risk */}
          {file.riskLevel !== "none" && (
            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-semibold border", cfg.bg, cfg.border, cfg.color)}>
              <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
              {cfg.label}
            </div>
          )}
        </div>
      </button>

      {/* Diff Content */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-0 overflow-hidden"
          >
            {file.chunks.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-muted-foreground">
                <FileCode className="w-5 h-5 mx-auto mb-2 opacity-40" />
                该文件暂无 diff 内容
              </div>
            ) : (
              file.chunks.map((chunk, ci) => (
                <div key={ci} className="relative z-0">
                  {/* Chunk Header */}
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-[oklch(0.62_0.19_240/0.06)] border-y border-[oklch(0.62_0.19_240/0.15)]">
                    <span className="text-[10px] font-mono text-[oklch(0.65_0.15_240)]">{chunk.header}</span>
                  </div>
                  {chunk.lines.map((line, li) => (
                    <DiffLineRow key={li} line={line} />
                  ))}
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface DiffViewerProps {
  files: DiffFile[]
  analyzing: boolean
  chunkProgress?: { current: number; total: number }
  loading?: boolean
}

export function DiffViewer({ files, analyzing, chunkProgress, loading }: DiffViewerProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        {zh.common.loadingDiff}
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
        暂无文件变更
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Chunk Analysis Banner */}
      {analyzing && chunkProgress && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[oklch(0.62_0.19_240/0.25)] bg-[oklch(0.62_0.19_240/0.06)]"
        >
          <Loader2 className="w-4 h-4 text-ai-blue animate-spin shrink-0" />
          <div className="flex-1">
            <span className="text-xs text-ai-blue">
              {zh.ai.analyzingChunk} {chunkProgress.current} / {chunkProgress.total}
            </span>
            <div className="mt-1 h-1 rounded-full bg-surface-4 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-ai-blue"
                animate={{ width: `${(chunkProgress.current / chunkProgress.total) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {Math.round((chunkProgress.current / chunkProgress.total) * 100)}%
          </span>
        </motion.div>
      )}

      {/* File List */}
      {files.map((file, i) => (
        <DiffFileCard key={file.path} file={file} index={i} />
      ))}
    </div>
  )
}
