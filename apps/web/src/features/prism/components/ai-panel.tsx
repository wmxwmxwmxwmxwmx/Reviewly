/**
 * @deprecated Superseded by ReviewInsightPanel + ReviewFileRail (ai-review-view three-column layout).
 * Kept for reference; not mounted in production routes.
 */
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BrainCircuit,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Loader2,
  GitMerge,
  ChevronDown,
  ChevronRight,
  Cpu,
  TriangleAlert,
  ScrollText,
} from "lucide-react"
import type { AnalysisFinding, AnalysisJob, AnalysisSummary, AiUsageMetrics } from "@reviewly/shared"
import { useAISettings } from "@/features/prism/contexts/ai-settings-context"
import { zh } from "@/lib/i18n/zh"
import { cn } from "@/lib/utils"
import type { RiskItem } from "@reviewly/shared"
import type { AIReviewPanelTab } from "@/features/prism/contexts/ai-review-session-context"
import { usePrGovernance } from "@/hooks/use-pr-governance"

type PanelTab = AIReviewPanelTab

function buildTabs(findingsCount: number): {
  key: PanelTab
  label: string
  icon: React.ElementType
  badge?: string
  disabled?: boolean
  title?: string
}[] {
  return [
    { key: "stream", label: "AI 流", icon: BrainCircuit },
    { key: "risks", label: "风险", icon: Shield, badge: findingsCount > 0 ? String(findingsCount) : undefined },
    { key: "merge", label: "合并", icon: GitMerge },
    { key: "governance", label: "治理", icon: ScrollText },
    {
      key: "incidents",
      label: "事故",
      icon: AlertTriangle,
      disabled: true,
      title: "即将推出",
    },
  ]
}

function findingToRiskItem(finding: AnalysisFinding): RiskItem {
  return {
    id: finding.id,
    severity: finding.severity,
    type: finding.type,
    title: finding.title,
    description: finding.description,
    file: finding.file,
    line: finding.line,
    cweId: finding.cweId,
    confidence: finding.confidence,
    rootCause: finding.rootCause,
    exploitability: "medium",
    fixSuggestion: finding.fixSuggestion,
    callChain: finding.callChain,
  }
}

const severityConfig = {
  critical: { icon: AlertOctagon, color: "text-risk-critical", bg: "bg-[oklch(0.55_0.22_27/0.10)]", border: "border-[oklch(0.55_0.22_27/0.30)]", label: "严重" },
  high: { icon: AlertTriangle, color: "text-risk-high", bg: "bg-[oklch(0.65_0.18_46/0.10)]", border: "border-[oklch(0.65_0.18_46/0.30)]", label: "高危" },
  medium: { icon: TriangleAlert, color: "text-risk-medium", bg: "bg-[oklch(0.75_0.16_83/0.10)]", border: "border-[oklch(0.75_0.16_83/0.30)]", label: "中危" },
  low: { icon: Info, color: "text-risk-low", bg: "bg-[oklch(0.62_0.17_148/0.10)]", border: "border-[oklch(0.62_0.17_148/0.30)]", label: "低危" },
}

type StreamLine = { type: "info" | "step" | "finding" | "done"; text: string }

function buildStreamLines(
  analyzing: boolean,
  job: AnalysisJob | undefined,
  findings: AnalysisFinding[],
  filesChanged: number,
): StreamLine[] {
  const lines: StreamLine[] = [
    {
      type: "info",
      text: `${zh.ai.stream.prContextLoaded} · ${filesChanged} ${zh.ai.stream.filesUnit}`,
    },
  ]

  if (job) {
    lines.push({
      type: "step",
      text: `${zh.ai.stream.scanProgress} ${job.chunkIndex}/${Math.max(job.chunkTotal, 1)} · ${job.progress}%`,
    })
  } else if (analyzing) {
    lines.push({ type: "step", text: zh.ai.stream.scanStarting })
  }

  for (const finding of findings.slice(0, 8)) {
    lines.push({
      type: "finding",
      text: `[${finding.severity}] ${finding.file}:${finding.line} — ${finding.title}`,
    })
  }

  if (!analyzing && findings.length > 0) {
    lines.push({
      type: "done",
      text: `${zh.ai.stream.scanDoneWithFindings} ${findings.length} ${zh.ai.stream.riskItemsUnit}`,
    })
  } else if (!analyzing && job?.status === "completed") {
    lines.push({ type: "done", text: zh.ai.stream.scanDoneNoFindings })
  } else if (analyzing) {
    lines.push({ type: "step", text: zh.ai.stream.mergingFindings })
  }

  return lines
}

function AIStreamPanel({
  analyzing,
  job,
  findings,
  filesChanged,
  approxContextChars = 0,
  runUsage,
}: {
  analyzing: boolean
  job?: AnalysisJob
  findings: AnalysisFinding[]
  filesChanged: number
  approxContextChars?: number
  runUsage?: AiUsageMetrics
}) {
  const streamLines = buildStreamLines(analyzing, job, findings, filesChanged)
  const { settings } = useAISettings()
  const contextBudget = 200_000
  const contextLabel =
    approxContextChars > 0
      ? `${Math.round(approxContextChars / 1000)}K / ${Math.round(contextBudget / 1000)}K`
      : "—"
  const contextPct =
    approxContextChars > 0
      ? Math.min(100, (approxContextChars / contextBudget) * 100)
      : analyzing && job
        ? Math.min(95, Math.max(8, job.progress))
        : 0

  return (
    <div className="space-y-3">
      {/* Model Info */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "模型", value: settings.model, icon: Cpu },
          {
            label: "延迟",
            value: runUsage?.latencyMs ? `${(runUsage.latencyMs / 1000).toFixed(2)}s` : "--",
            icon: Cpu,
          },
          {
            label: "Token 用量",
            value: runUsage?.totalTokens ? runUsage.totalTokens.toLocaleString() : analyzing ? "…" : "0",
            icon: BrainCircuit,
          },
          {
            label: "本次成本",
            value:
              runUsage?.costCny != null
                ? `¥${runUsage.costCny.toFixed(4)}`
                : analyzing
                  ? "…"
                  : "--",
            icon: Info,
          },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-surface-2 border border-border">
            <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground">{item.label}</div>
              <div className="text-[11px] font-semibold text-foreground font-mono truncate">{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Context Window */}
      <div className="px-3 py-2 rounded-md bg-surface-2 border border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground">{zh.ai.contextWindow}</span>
          <span className="text-[10px] font-mono text-foreground">{contextLabel}</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-4 overflow-hidden">
          {analyzing && approxContextChars === 0 ? (
            <motion.div
              className="h-full w-1/3 rounded-full bg-ai-blue"
              animate={{ x: ["-100%", "250%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            <motion.div
              className="h-full rounded-full bg-ai-blue"
              initial={{ width: 0 }}
              animate={{ width: `${contextPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          )}
        </div>
        {approxContextChars === 0 && !analyzing && (
          <p className="text-[9px] text-muted-foreground mt-1">基于 Diff 估算，分析后更新</p>
        )}
      </div>

      {/* Stream Log */}
      <div className="rounded-md border border-border bg-surface-1 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <div className={cn("w-2 h-2 rounded-full", analyzing ? "bg-ai-blue glow-pulse" : "bg-risk-low")} />
          <span className="text-[10px] font-semibold text-foreground">推理日志</span>
          {analyzing && (
            <div className="flex items-center gap-1 ml-1">
              <div className="thinking-dot w-1 h-1 rounded-full bg-ai-blue" />
              <div className="thinking-dot w-1 h-1 rounded-full bg-ai-blue" />
              <div className="thinking-dot w-1 h-1 rounded-full bg-ai-blue" />
            </div>
          )}
        </div>
        <div className="p-2 space-y-1 max-h-52 overflow-y-auto font-mono text-[10px]">
          {streamLines.map((line, i) => (
            <motion.div
              key={`${line.type}-${line.text}-${i}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "flex items-start gap-1.5 px-2 py-1 rounded",
                line.type === "finding" ? "bg-[oklch(0.55_0.22_27/0.06)] text-risk-high" :
                line.type === "done" ? "bg-[oklch(0.62_0.17_148/0.06)] text-risk-low" :
                line.type === "step" ? "text-ai-blue" : "text-muted-foreground"
              )}
            >
              <span className="opacity-50 shrink-0">{String(i).padStart(2, "0")}</span>
              <span>{line.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Risk Panel ────────────────────────────────────────────────────────────────
function RiskCard({ risk, index }: { risk: RiskItem; index: number }) {
  const [expanded, setExpanded] = useState(index < 2)
  const cfg = severityConfig[risk.severity] ?? severityConfig.medium

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn("rounded-md border overflow-hidden", cfg.border)}
    >
      <button
        className={cn("w-full flex items-start gap-2.5 px-3 py-2.5 text-left", expanded ? cfg.bg : "hover:bg-accent transition-colors")}
        onClick={() => setExpanded(!expanded)}
      >
        <cfg.icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", cfg.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn("text-[9px] font-bold uppercase tracking-wider", cfg.color)}>{cfg.label}</span>
            <span className="text-[9px] text-muted-foreground">{risk.type}</span>
            {risk.cweId && (
              <span className="text-[9px] px-1 rounded bg-surface-4 text-muted-foreground font-mono">{risk.cweId}</span>
            )}
          </div>
          <p className="text-[11px] font-medium text-foreground truncate">{risk.title}</p>
          <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{risk.file}:{risk.line}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[9px] text-muted-foreground">{risk.confidence}%</span>
          {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
              <p className="text-[11px] text-muted-foreground leading-relaxed">{risk.description}</p>
              <div className="space-y-1.5">
                <div className="text-[10px] text-muted-foreground">
                  <span className="text-foreground font-medium">根因：</span> {risk.rootCause}
                </div>
                {risk.callChain && (
                  <div className="text-[10px] font-mono text-muted-foreground px-2 py-1.5 rounded bg-surface-2 border border-border">
                    {risk.callChain.join(" → ")}
                  </div>
                )}
                <div className={cn("text-[10px] px-2 py-1.5 rounded border", cfg.bg, cfg.border, cfg.color)}>
                  <span className="font-medium">修复建议：</span> {risk.fixSuggestion}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function RisksPanel({ findings }: { findings: AnalysisFinding[] }) {
  const risks = findings.map(findingToRiskItem)

  if (risks.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground py-6 text-center">
        暂无风险项。点击「开始分析」对当前 Diff 执行规则扫描。
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
        {(["critical", "high", "medium", "low"] as const).map((s) => {
          const count = risks.filter((r) => r.severity === s).length
          const cfg = severityConfig[s]
          return (
            <div key={s} className={cn("flex flex-col items-center gap-0.5 py-2 rounded-md border", cfg.bg, cfg.border)}>
              <span className={cn("text-base font-bold tabular-nums", cfg.color)}>{count}</span>
              <span className={cn("text-[9px]", cfg.color)}>{cfg.label}</span>
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        {risks.map((risk, i) => (
          <RiskCard key={risk.id} risk={risk} index={i} />
        ))}
      </div>
    </div>
  )
}

// ── Merge Panel ───────────────────────────────────────────────────────────────
function MergePanel({
  mergeRecommendation,
  criticalCount,
}: {
  mergeRecommendation?: AnalysisSummary["mergeRecommendation"]
  criticalCount: number
}) {
  const recommendationLabel =
    mergeRecommendation === "approve"
      ? "建议合并"
      : mergeRecommendation === "block"
        ? "建议阻止合并"
        : mergeRecommendation === "request_changes"
          ? "建议修改后再合并"
          : "尚未分析"

  const checks = [
    {
      label: "规则扫描结论",
      status: mergeRecommendation === "approve" ? "pass" : mergeRecommendation ? "fail" : "pending",
      detail: recommendationLabel,
    },
    {
      label: "严重安全问题",
      status: criticalCount > 0 ? "fail" : mergeRecommendation ? "pass" : "pending",
      detail: criticalCount > 0 ? `${criticalCount} 处${zh.severity.critical}待处理` : "未发现严重项",
    },
    { label: zh.ai.merge.breakingChangeRecord, status: "pending", detail: "需结合 Diff 人工确认" },
  ]

  const iconMap = {
    pass: <CheckCircle2 className="w-4 h-4 text-risk-low shrink-0" />,
    fail: <XCircle className="w-4 h-4 text-risk-critical shrink-0" />,
    warn: <AlertTriangle className="w-4 h-4 text-risk-high shrink-0" />,
    pending: <Clock className="w-4 h-4 text-muted-foreground shrink-0" />,
  }

  const blockingCount = checks.filter(c => c.status === "fail").length

  return (
    <div className="space-y-3">
      <div className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border",
        blockingCount > 0
          ? "bg-[oklch(0.55_0.22_27/0.08)] border-[oklch(0.55_0.22_27/0.3)] text-risk-critical"
          : "bg-[oklch(0.62_0.17_148/0.08)] border-[oklch(0.62_0.17_148/0.3)] text-risk-low"
      )}>
        {blockingCount > 0 ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
        <div className="flex-1">
          <div className="text-xs font-semibold">
            {blockingCount > 0 ? `${blockingCount} 项阻塞合并` : "可以合并"}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-start gap-2.5 px-2.5 py-2 rounded-md bg-surface-2 border border-border">
            {iconMap[check.status as keyof typeof iconMap]}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-foreground">{check.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{check.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Governance Panel ──────────────────────────────────────────────────────────
function governanceRuleStatus(rule: {
  violated?: boolean
  severity: string
}) {
  if (rule.violated) return "fail"
  if (rule.severity === "critical" || rule.severity === "high") return "warn"
  return "pass"
}

function GovernancePanel({
  prId,
  refreshKey,
}: {
  prId: string
  refreshKey: number
}) {
  const { rules, loading, error } = usePrGovernance(prId, refreshKey)
  const violated = rules.filter((r) => r.violated)
  const passed = rules.length - violated.length

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[11px] text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-ai-blue" />
        加载治理规则…
      </div>
    )
  }

  if (error) {
    return <p className="text-[11px] text-risk-high py-4 text-center">{error}</p>
  }

  if (rules.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground py-6 text-center">
        暂无治理规则。可在侧栏「工程治理」配置规则。
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px]",
          violated.length > 0
            ? "bg-[oklch(0.55_0.22_27/0.08)] border-[oklch(0.55_0.22_27/0.3)] text-risk-high"
            : "bg-[oklch(0.62_0.17_148/0.08)] border-[oklch(0.62_0.17_148/0.3)] text-risk-low",
        )}
      >
        {violated.length > 0 ? (
          <XCircle className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="font-medium">
          {violated.length > 0
            ? `${violated.length} 条规则未通过`
            : `全部 ${rules.length} 条规则通过`}
        </span>
        <span className="text-muted-foreground ml-auto">{passed}/{rules.length}</span>
      </div>

      <div className="space-y-1.5">
        {rules.map((rule) => {
          const status = governanceRuleStatus(rule)
          const icon =
            status === "fail" ? (
              <XCircle className="w-3.5 h-3.5 text-risk-critical shrink-0" />
            ) : status === "warn" ? (
              <AlertTriangle className="w-3.5 h-3.5 text-risk-medium shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-risk-low shrink-0" />
            )
          return (
            <div
              key={rule.id}
              className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-surface-2 border border-border"
            >
              {icon}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-foreground leading-snug">{rule.rule}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {rule.severity}
                  {rule.file ? ` · ${rule.file}` : ""}
                </div>
                {rule.feedback && (
                  <p
                    className={cn(
                      "text-[10px] mt-1 leading-snug",
                      rule.violated ? "text-risk-high" : "text-risk-low",
                    )}
                  >
                    {rule.feedback}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-muted-foreground leading-snug px-0.5">
        完成「启动分析」后会自动对照 Diff 与 findings 重新评估。侧栏「工程治理」可增删改规则。
      </p>
    </div>
  )
}

// ── Incidents Panel ───────────────────────────────────────────────────────────
function IncidentsPanel() {
  return (
    <p className="text-[11px] text-muted-foreground py-6 text-center">
      历史事故关联尚未接入 API。
    </p>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────
interface AIPanelProps {
  prId: string
  governanceRefreshKey?: number
  analyzing: boolean
  findings?: AnalysisFinding[]
  job?: AnalysisJob
  mergeRecommendation?: AnalysisSummary["mergeRecommendation"]
  filesChanged?: number
  approxContextChars?: number
  runUsage?: AiUsageMetrics
  activeTab?: PanelTab
  onActiveTabChange?: (tab: PanelTab) => void
}

export function AIPanel({
  prId,
  governanceRefreshKey = 0,
  analyzing,
  findings = [],
  job,
  mergeRecommendation,
  filesChanged = 0,
  approxContextChars = 0,
  runUsage,
  activeTab: activeTabProp,
  onActiveTabChange,
}: AIPanelProps) {
  const [internalTab, setInternalTab] = useState<PanelTab>("risks")
  const activeTab = activeTabProp ?? internalTab
  const setActiveTab = (tab: PanelTab) => {
    onActiveTabChange?.(tab)
    if (activeTabProp === undefined) {
      setInternalTab(tab)
    }
  }
  const tabs = buildTabs(findings.length)
  const criticalCount = findings.filter((f) => f.severity === "critical").length

  return (
    <aside className="w-[390px] shrink-0 flex flex-col h-screen border-l border-border bg-[oklch(0.125_0.004_264)]">
      {/* Panel Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
        <BrainCircuit className="w-4 h-4 text-ai-blue shrink-0" />
        <span className="text-sm font-semibold text-foreground">评审面板</span>
        {analyzing && (
          <div className="flex items-center gap-1 ml-1">
            <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
            <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
            <div className="thinking-dot w-1.5 h-1.5 rounded-full bg-ai-blue" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-2 gap-0.5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            disabled={tab.disabled}
            title={tab.title}
            onClick={() => {
              if (!tab.disabled) setActiveTab(tab.key)
            }}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors",
              tab.disabled && "opacity-40 cursor-not-allowed",
              activeTab === tab.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-3.5 h-3.5 shrink-0" />
            {tab.label}
            {tab.badge && (
              <span className={cn(
                "text-[9px] px-1 py-0.5 rounded-full font-semibold",
                activeTab === tab.key
                  ? "bg-[oklch(0.62_0.19_240/0.2)] text-ai-blue"
                  : "bg-surface-3 text-muted-foreground"
              )}>
                {tab.badge}
              </span>
            )}
            {activeTab === tab.key && (
              <motion.div
                layoutId="panel-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-ai-blue rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
            {activeTab === "stream" && (
              <AIStreamPanel
                analyzing={analyzing}
                job={job}
                findings={findings}
                filesChanged={filesChanged}
                approxContextChars={approxContextChars}
                runUsage={runUsage}
              />
            )}
            {activeTab === "risks" && <RisksPanel findings={findings} />}
            {activeTab === "merge" && (
              <MergePanel mergeRecommendation={mergeRecommendation} criticalCount={criticalCount} />
            )}
            {activeTab === "governance" && (
              <GovernancePanel prId={prId} refreshKey={governanceRefreshKey} />
            )}
            {activeTab === "incidents" && <IncidentsPanel />}
          </motion.div>
      </div>
    </aside>
  )
}
