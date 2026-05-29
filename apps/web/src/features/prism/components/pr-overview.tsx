"use client"

import { motion } from "framer-motion"
import {
  GitCommit,
  FileCode,
  Plus,
  Minus,
  Clock,
  Tag,
  Users,
  AlertTriangle,
  TrendingUp,
  Shield,
  Wrench,
  Rocket,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format-relative-time"
import { zh } from "@/lib/i18n/zh"
import type { AnalysisSummary, PullRequest } from "@reviewly/shared"

interface PROverviewProps {
  prData: PullRequest
  analysisScores?: Pick<
    AnalysisSummary,
    "riskScore" | "securityScore" | "performanceScore" | "maintainabilityScore"
  >
}

const riskConfig = {
  critical: { label: "严重风险", color: "text-risk-critical", bg: "bg-[oklch(0.55_0.22_27/0.12)]", border: "border-[oklch(0.55_0.22_27/0.3)]", ring: "oklch(0.55 0.22 27)", glow: "shadow-[0_0_20px_4px_oklch(0.55_0.22_27/0.25)]" },
  high: { label: "高风险", color: "text-risk-high", bg: "bg-[oklch(0.65_0.18_46/0.12)]", border: "border-[oklch(0.65_0.18_46/0.3)]", ring: "oklch(0.65 0.18 46)", glow: "shadow-[0_0_20px_4px_oklch(0.65_0.18_46/0.25)]" },
  medium: { label: "中风险", color: "text-risk-medium", bg: "bg-[oklch(0.75_0.16_83/0.12)]", border: "border-[oklch(0.75_0.16_83/0.3)]", ring: "oklch(0.75 0.16 83)", glow: "shadow-[0_0_20px_4px_oklch(0.75_0.16_83/0.25)]" },
  low: { label: "低风险", color: "text-risk-low", bg: "bg-[oklch(0.62_0.17_148/0.12)]", border: "border-[oklch(0.62_0.17_148/0.3)]", ring: "oklch(0.62 0.17 148)", glow: "shadow-[0_0_20px_4px_oklch(0.62_0.17_148/0.25)]" },
}

const deployRisk = {
  high: { label: "高", color: "text-risk-high" },
  medium: { label: "中", color: "text-risk-medium" },
  low: { label: "低", color: "text-risk-low" },
}

type RiskLevelKey = keyof typeof riskConfig
type DeployRiskKey = keyof typeof deployRisk

function getRiskConfig(level: string | undefined) {
  if (level && level in riskConfig) {
    return riskConfig[level as RiskLevelKey]
  }
  return riskConfig.medium
}

function getDeployRisk(level: string | undefined) {
  if (level && level in deployRisk) {
    return deployRisk[level as DeployRiskKey]
  }
  return deployRisk.medium
}

function RiskRing({ score, riskLevel }: { score: number; riskLevel: RiskLevelKey }) {
  const cfg = riskConfig[riskLevel]
  const r = 40
  const circ = 2 * Math.PI * r
  const dashOffset = circ - (score / 100) * circ

  return (
    <div className={cn("relative flex items-center justify-center w-28 h-28 rounded-full", cfg.glow)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="oklch(0.22 0.006 264)" strokeWidth="7" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={cfg.ring}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <motion.span
          className={cn("text-2xl font-bold tabular-nums", cfg.color)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-widest">/ 100</span>
      </div>
    </div>
  )
}

function ScoreBar({ label, score, icon: Icon, color }: { label: string; score: number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className={cn("w-3.5 h-3.5 shrink-0", color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground">{label}</span>
          <span className={cn("text-[11px] font-semibold tabular-nums", color)}>{score}</span>
        </div>
        <div className="h-1 rounded-full bg-surface-4 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: `${color.replace("text-", "")}` }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
          />
        </div>
      </div>
    </div>
  )
}

export function PROverview({ prData, analysisScores }: PROverviewProps) {
  const cfg = getRiskConfig(prData.riskLevel)
  const deployCfg = getDeployRisk(prData.deploymentRisk)
  const rollbackCfg = getDeployRisk(prData.rollbackComplexity)
  const riskRingLevel: RiskLevelKey =
    prData.riskLevel && prData.riskLevel in riskConfig
      ? (prData.riskLevel as RiskLevelKey)
      : "medium"

  const riskScore = analysisScores?.riskScore ?? prData.riskScore ?? 0
  const securityScore = analysisScores?.securityScore ?? prData.securityScore ?? 0
  const performanceScore = analysisScores?.performanceScore ?? prData.performanceScore ?? 0
  const maintainabilityScore = analysisScores?.maintainabilityScore ?? prData.maintainabilityScore ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "rounded-lg border bg-card p-5",
        cfg.border
      )}
    >
      <div className="flex gap-6">
        {/* Left: PR Info */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-start gap-2 mb-3">
            <div className={cn("mt-1 w-2.5 h-2.5 rounded-full shrink-0", cfg.bg, "border", cfg.border)} />
            <h2 className="text-sm font-semibold text-foreground leading-relaxed">{prData.title}</h2>
          </div>

          {/* Meta Row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[oklch(0.55_0.19_240)] to-[oklch(0.45_0.14_264)] flex items-center justify-center text-[9px] font-semibold text-white">
                {prData.authorAvatar}
              </div>
              <span>{prData.author}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatRelativeTime(prData.updatedAt ?? prData.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <GitCommit className="w-3 h-3" />
              <span>
                {prData.commits} {zh.pr.commits}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <FileCode className="w-3 h-3" />
              <span>{prData.filesChanged} 文件</span>
            </div>
            <div className="flex items-center gap-1 text-risk-low">
              <Plus className="w-3 h-3" />
              <span>+{prData.additions.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 text-risk-critical">
              <Minus className="w-3 h-3" />
              <span>-{prData.deletions.toLocaleString()}</span>
            </div>
          </div>

          {/* Labels */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {prData.labels.map((label) => (
              <span
                key={label.name}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border"
                style={{
                  color: label.color,
                  borderColor: `${label.color}40`,
                  backgroundColor: `${label.color}12`,
                }}
              >
                <Tag className="w-2.5 h-2.5" />
                {label.name}
              </span>
            ))}
          </div>

          {/* Sub Scores */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            <ScoreBar label="安全评分" score={securityScore} icon={Shield} color="text-risk-high" />
            <ScoreBar label="性能评分" score={performanceScore} icon={TrendingUp} color="text-ai-blue" />
            <ScoreBar label="可维护性" score={maintainabilityScore} icon={Wrench} color="text-risk-medium" />
            <div className="flex items-center gap-2.5">
              <Rocket className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">部署风险</span>
                  <span className={cn("text-[11px] font-semibold", deployCfg.color)}>
                    {deployCfg.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">回滚复杂度</span>
                  <span className={cn("text-[11px] font-semibold", rollbackCfg.color)}>
                    {rollbackCfg.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Risk Ring */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <RiskRing score={riskScore} riskLevel={riskRingLevel} />
          <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border", cfg.bg, cfg.border, cfg.color)}>
            <AlertTriangle className="w-3 h-3" />
            {cfg.label}
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground">综合风险</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
