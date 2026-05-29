"use client"

import type { ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

/** Collapse blank lines inside GFM table blocks so parsing stays stable. */
export function normalizeMarkdownTables(markdown: string): string {
  const lines = markdown.split("\n")
  const result: string[] = []
  let inTable = false

  for (const line of lines) {
    const isTableRow = /^\s*\|/.test(line)
    if (isTableRow) {
      inTable = true
      result.push(line)
      continue
    }
    if (inTable && line.trim() === "") {
      continue
    }
    inTable = false
    result.push(line)
  }

  return result.join("\n")
}

function formatInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`${match.index}-b`} className="text-foreground font-medium">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      parts.push(
        <code
          key={`${match.index}-c`}
          className="px-1 py-0.5 rounded bg-surface-3 text-[10px] font-mono text-ai-blue"
        >
          {token.slice(1, -1)}
        </code>,
      )
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  const cells = parseTableRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "table"; rows: string[][] }
  | { type: "ul"; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "paragraph"; text: string }

function parseBlocks(markdown: string): MarkdownBlock[] {
  const lines = normalizeMarkdownTables(markdown).split("\n")
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed === "") {
      index += 1
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      })
      index += 1
      continue
    }

    if (trimmed.startsWith("|")) {
      const tableLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index])
        index += 1
      }
      const rows = tableLines
        .filter((row) => !isTableSeparator(row))
        .map(parseTableRow)
        .filter((row) => row.some((cell) => cell.length > 0))
      if (rows.length > 0) {
        blocks.push({ type: "table", rows })
      }
      continue
    }

    if (trimmed.startsWith("> ")) {
      blocks.push({ type: "blockquote", text: trimmed.slice(2) })
      index += 1
      continue
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = []
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2))
        index += 1
      }
      blocks.push({ type: "ul", items })
      continue
    }

    const paragraphLines: string[] = [trimmed]
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !lines[index].trim().startsWith("#") &&
      !lines[index].trim().startsWith("|") &&
      !lines[index].trim().startsWith("- ") &&
      !lines[index].trim().startsWith("> ")
    ) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") })
  }

  return blocks
}

const headingClass: Record<number, string> = {
  1: "text-sm font-semibold text-foreground mt-3 mb-1.5 first:mt-0",
  2: "text-xs font-semibold text-foreground mt-3 mb-1 first:mt-0",
  3: "text-xs font-semibold text-foreground mt-2.5 mb-1 first:mt-0",
  4: "text-[11px] font-semibold text-foreground mt-2 mb-0.5 first:mt-0",
  5: "text-[11px] font-medium text-foreground mt-2 mb-0.5",
  6: "text-[11px] font-medium text-muted-foreground mt-1.5 mb-0.5",
}

function MarkdownTable({ rows }: { rows: string[][] }) {
  if (rows.length === 0) return null

  const [header, ...body] = rows

  return (
    <div className="overflow-x-auto rounded-md border border-border my-2">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-surface-2">
            {header.map((cell, i) => (
              <th
                key={`h-${i}`}
                className="px-2.5 py-1.5 text-left font-semibold text-foreground border-b border-border"
              >
                {formatInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        {body.length > 0 && (
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={`r-${rowIndex}`} className="border-b border-border last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`c-${rowIndex}-${cellIndex}`}
                    className="px-2.5 py-1.5 text-muted-foreground align-top"
                  >
                    {formatInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  )
}

function renderBlock(block: MarkdownBlock, key: string) {
  switch (block.type) {
    case "heading": {
      const level = Math.min(block.level, 6)
      const className = headingClass[level] ?? headingClass[3]
      const content = formatInline(block.text)
      if (level === 1) return <h1 key={key} className={className}>{content}</h1>
      if (level === 2) return <h2 key={key} className={className}>{content}</h2>
      if (level === 3) return <h3 key={key} className={className}>{content}</h3>
      if (level === 4) return <h4 key={key} className={className}>{content}</h4>
      if (level === 5) return <h5 key={key} className={className}>{content}</h5>
      return <h6 key={key} className={className}>{content}</h6>
    }
    case "table":
      return <MarkdownTable key={key} rows={block.rows} />
    case "ul":
      return (
        <ul key={key} className="space-y-1 pl-1 my-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
              <span className="leading-relaxed">{formatInline(item)}</span>
            </li>
          ))}
        </ul>
      )
    case "blockquote":
      return (
        <div
          key={key}
          className="flex items-start gap-2 px-3 py-2 my-1.5 rounded bg-[oklch(0.55_0.22_27/0.08)] border border-[oklch(0.55_0.22_27/0.2)] text-[11px] text-risk-high"
        >
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{formatInline(block.text)}</span>
        </div>
      )
    case "paragraph":
      return (
        <p key={key} className="text-[11px] text-muted-foreground leading-relaxed my-1">
          {formatInline(block.text)}
        </p>
      )
    default:
      return null
  }
}

interface SummaryMarkdownProps {
  content: string
  className?: string
}

export function SummaryMarkdown({ content, className }: SummaryMarkdownProps) {
  const blocks = parseBlocks(content)

  return (
    <div className={cn("space-y-0.5", className)}>
      {blocks.map((block, i) => renderBlock(block, `md-${i}`))}
    </div>
  )
}
