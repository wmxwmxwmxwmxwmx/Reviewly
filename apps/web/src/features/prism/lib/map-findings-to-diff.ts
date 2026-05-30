import type { AnalysisFinding } from "@reviewly/shared"
import type { DiffFile, DiffLine } from "@reviewly/shared"

const SEVERITY_RANK: Record<AnalysisFinding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

type RiskLevel = DiffFile["riskLevel"]

function severityToRiskLevel(severity: AnalysisFinding["severity"]): RiskLevel {
  if (severity === "critical") return "critical"
  if (severity === "high") return "high"
  if (severity === "medium") return "medium"
  if (severity === "low") return "low"
  return "none"
}

function mergeRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["critical", "high", "medium", "low", "none"]
  return order[Math.min(order.indexOf(a), order.indexOf(b))] ?? "none"
}

/** Match finding path to diff file path (exact or suffix). */
export function matchDiffFilePath(diffPath: string, findingPath: string): boolean {
  if (diffPath === findingPath) return true
  return diffPath.endsWith(`/${findingPath}`) || findingPath.endsWith(`/${diffPath}`)
}

function riskCommentFromFinding(f: AnalysisFinding): NonNullable<DiffLine["riskComment"]> {
  const severity =
    f.severity === "critical" || f.severity === "high" || f.severity === "medium"
      ? f.severity
      : "medium"
  return {
    severity,
    message: f.title + (f.description ? ` — ${f.description}` : ""),
  }
}

/** Attach file-level risk and line-level riskComment from analysis findings. */
export function enrichDiffFilesWithFindings(
  files: DiffFile[],
  findings: AnalysisFinding[],
): DiffFile[] {
  if (findings.length === 0) return files

  const byFile = new Map<string, AnalysisFinding[]>()
  for (const f of findings) {
    const list = byFile.get(f.file) ?? []
    list.push(f)
    byFile.set(f.file, list)
  }

  return files.map((file) => {
    const matched: AnalysisFinding[] = []
    for (const [fpath, list] of byFile) {
      if (matchDiffFilePath(file.path, fpath)) {
        matched.push(...list)
      }
    }
    if (matched.length === 0) {
      return file
    }

    let fileRisk: RiskLevel = "none"
    for (const f of matched) {
      fileRisk = mergeRiskLevel(fileRisk, severityToRiskLevel(f.severity))
    }

    const lineTargets = new Map<number, AnalysisFinding>()
    for (const f of matched) {
      const line = f.line > 0 ? f.line : 0
      const prev = lineTargets.get(line)
      if (!prev || SEVERITY_RANK[f.severity] < SEVERITY_RANK[prev.severity]) {
        lineTargets.set(line, f)
      }
    }

    const chunks = (file.chunks ?? []).map((chunk) => ({
      ...chunk,
      lines: chunk.lines.map((line) => {
        const targetLine = line.newNum ?? line.oldNum
        if (targetLine === undefined) return line
        const finding = lineTargets.get(targetLine)
        if (!finding) return line
        return { ...line, riskComment: riskCommentFromFinding(finding) }
      }),
    }))

    return { ...file, riskLevel: fileRisk, chunks }
  })
}

export interface FindingScrollTarget {
  findingId: string
  file: string
  line: number
}

export function scrollTargetFromFinding(f: AnalysisFinding): FindingScrollTarget {
  return { findingId: f.id, file: f.file, line: f.line }
}

export function diffFileDomId(filePath: string): string {
  return `diff-file-${encodeURIComponent(filePath).replace(/%/g, "_")}`
}

export function diffLineDomId(filePath: string, line: number): string {
  return `${diffFileDomId(filePath)}-line-${line}`
}

/** Group findings by file for the left rail. */
export function groupFindingsByFile(findings: AnalysisFinding[]): {
  file: string
  findings: AnalysisFinding[]
  maxSeverity: AnalysisFinding["severity"]
}[] {
  const map = new Map<string, AnalysisFinding[]>()
  for (const f of findings) {
    const list = map.get(f.file) ?? []
    list.push(f)
    map.set(f.file, list)
  }

  const groups = [...map.entries()].map(([file, list]) => {
    const sorted = [...list].sort((a, b) => {
      const sd = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (sd !== 0) return sd
      return a.line - b.line
    })
    const maxSeverity = sorted[0]?.severity ?? "low"
    return { file, findings: sorted, maxSeverity }
  })

  groups.sort((a, b) => {
    const sd = SEVERITY_RANK[a.maxSeverity] - SEVERITY_RANK[b.maxSeverity]
    if (sd !== 0) return sd
    return a.file.localeCompare(b.file)
  })

  return groups
}
